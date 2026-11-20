package dev.swiftbuild.client.render;

import dev.swiftbuild.client.ClientConfig;
import dev.swiftbuild.client.Easing;
import dev.swiftbuild.net.AnimationPayload;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.WorldRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

/**
 * Plays the build animations sent by the server:
 * <ul>
 *   <li>grow: the block drops in from slightly above, spins into place and pops with a small overshoot,
 *   with a glowing outline that fades out;</li>
 *   <li>shrink: once the real block is gone, a copy winds up, spins and shrinks to nothing while sinking.</li>
 * </ul>
 */
public final class AnimationManager {
	private static final int MAX_DRAWN = 6000;
	private static final long HOLD_MS = 1500;

	private static final class Anim {
		final BlockPos pos;
		final BlockState state;
		final long start;
		final long duration;
		final boolean grow;
		long vanishedAt = -1;
		boolean sparkled;

		Anim(BlockPos pos, BlockState state, long start, long duration, boolean grow) {
			this.pos = pos;
			this.state = state;
			this.start = start;
			this.duration = duration;
			this.grow = grow;
		}
	}

	private static final List<Anim> ANIMS = new ArrayList<>();

	private AnimationManager() {
	}

	public static void accept(AnimationPayload payload) {
		if (!ClientConfig.get().animations) {
			return;
		}
		long now = Util.getMeasuringTimeMs();
		long duration = Math.max(120, payload.animTicks() * 50L);
		for (AnimationPayload.Entry e : payload.entries()) {
			BlockState state = Block.getStateFromRawId(e.stateId());
			if (state.isAir()) {
				continue;
			}
			ANIMS.add(new Anim(e.pos(), state, now + e.delayTicks() * 50L, duration, e.kind() == AnimationPayload.GROW));
		}
	}

	public static void clear() {
		ANIMS.clear();
	}

	public static boolean isAnimating(BlockPos pos) {
		for (Anim a : ANIMS) {
			if (a.grow && a.pos.equals(pos)) {
				return true;
			}
		}
		return false;
	}

	public static void render(MatrixStack matrices, VertexConsumerProvider consumers, Vec3d cam) {
		ClientWorld world = MinecraftClient.getInstance().world;
		if (world == null || ANIMS.isEmpty()) {
			return;
		}
		long now = Util.getMeasuringTimeMs();
		int drawn = 0;
		int sparkles = 0;
		Iterator<Anim> it = ANIMS.iterator();
		while (it.hasNext()) {
			Anim a = it.next();
			if (now < a.start) {
				continue;
			}
			BlockState actual = world.getBlockState(a.pos);
			double cx = a.pos.getX() + 0.5 - cam.x;
			double cy = a.pos.getY() + 0.5 - cam.y;
			double cz = a.pos.getZ() + 0.5 - cam.z;
			if (a.grow) {
				float t = (now - a.start) / (float) a.duration;
				if (t >= 1) {
					if (!a.sparkled && sparkles < 24) {
						a.sparkled = true;
						sparkles++;
						sparkle(world, a.pos);
					}
					if (actual.equals(a.state) || now > a.start + a.duration + HOLD_MS) {
						it.remove();
						continue;
					}
					t = 1;
				}
				if (drawn++ > MAX_DRAWN) {
					continue;
				}
				float scale = Math.max(0.02f, Easing.outBack(t));
				float yaw = (1 - Easing.outCubic(t)) * -90f;
				double drop = (1 - Easing.outCubic(t)) * 0.6;
				float alpha = Easing.clamp(t * 3f);
				int light = WorldRenderer.getLightmapCoordinates(world, a.pos);
				boolean model = BlockDrawer.drawBlock(matrices, consumers, a.state, a.pos, cx, cy + drop, cz, scale, yaw, alpha, light, 1f, 1f, 1f);
				int glow = (int) ((1 - t) * 255) << 24 | 0x6FF3FF;
				if (!model) {
					glow = 0xFF6FF3FF;
				}
				if ((glow >>> 24) > 4) {
					BlockDrawer.drawCubeOutline(matrices, consumers, cx, cy + drop, cz, scale * 1.02f, yaw, glow, 2.5f);
				}
			} else {
				if (a.vanishedAt < 0) {
					if (actual.equals(a.state)) {
						if (now > a.start + 3000) {
							it.remove();
						}
						continue;
					}
					a.vanishedAt = now;
				}
				float t = (now - a.vanishedAt) / (float) a.duration;
				if (t >= 1) {
					it.remove();
					continue;
				}
				if (drawn++ > MAX_DRAWN) {
					continue;
				}
				float scale = Math.max(0.0f, 1 - Easing.inBack(t));
				float yaw = Easing.inCubic(t) * 120f;
				double sink = -0.3 * Easing.inCubic(t);
				float alpha = 1 - t * t;
				int light = WorldRenderer.getLightmapCoordinates(world, a.pos);
				if (scale > 0.01f) {
					BlockDrawer.drawBlock(matrices, consumers, a.state, a.pos, cx, cy + sink, cz, scale, yaw, alpha, light, 1f, 0.85f, 0.85f);
				}
			}
		}
	}

	private static void sparkle(ClientWorld world, BlockPos pos) {
		for (int i = 0; i < 3; i++) {
			double x = pos.getX() + world.random.nextDouble();
			double y = pos.getY() + 1.02;
			double z = pos.getZ() + world.random.nextDouble();
			world.addParticleClient(ParticleTypes.WAX_ON, x, y, z, 0, 0.02, 0);
		}
	}
}
