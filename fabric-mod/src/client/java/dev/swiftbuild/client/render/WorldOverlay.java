package dev.swiftbuild.client.render;

import dev.swiftbuild.build.BuildAction;
import dev.swiftbuild.build.Modifiers;
import dev.swiftbuild.client.BuildController;
import dev.swiftbuild.client.ClientConfig;
import java.util.List;
import net.fabricmc.fabric.api.client.rendering.v1.world.WorldRenderContext;
import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.LightmapTextureManager;
import net.minecraft.client.render.RenderLayers;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/** World-space rendering: hologram preview, modifier guides and the build animations. */
public final class WorldOverlay {
	private static final int MAX_GHOSTS = 2500;
	private static final int MAX_OUTLINES = 600;

	private WorldOverlay() {
	}

	public static void render(WorldRenderContext context) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.world == null || mc.player == null) {
			return;
		}
		MatrixStack matrices = context.matrices();
		VertexConsumerProvider consumers = context.consumers();
		Vec3d cam = context.worldState().cameraRenderState.pos;

		AnimationManager.render(matrices, consumers, cam);

		if (!ClientConfig.get().preview || mc.options.hudHidden) {
			return;
		}
		float delta = mc.getRenderTickCounter().getTickProgress(true);
		BuildController.Preview preview = BuildController.preview(mc, delta);
		if (preview != null) {
			if (preview.action() == BuildAction.PLACE) {
				renderPlace(matrices, consumers, cam, preview);
			} else {
				renderBreak(matrices, consumers, cam, preview);
			}
		}
		if (BuildController.placeActive() || BuildController.breakActive()) {
			renderModifierGuides(mc, matrices, consumers, cam);
		}
	}

	private static float pulse() {
		return 0.5f + 0.5f * MathHelper.sin((Util.getMeasuringTimeMs() % 100000L) / 1000f * 4.0f);
	}

	private static void renderPlace(MatrixStack matrices, VertexConsumerProvider consumers, Vec3d cam, BuildController.Preview preview) {
		List<BlockPos> positions = preview.positions();
		List<BlockState> states = preview.states();
		float p = pulse();
		float alpha = 0.38f + 0.14f * p;
		int light = LightmapTextureManager.MAX_LIGHT_COORDINATE;
		boolean ghosts = positions.size() <= MAX_GHOSTS;
		for (int i = 0; i < positions.size(); i++) {
			BlockPos pos = positions.get(i);
			if (AnimationManager.isAnimating(pos)) {
				continue;
			}
			double x = pos.getX() + 0.5 - cam.x;
			double y = pos.getY() + 0.5 - cam.y;
			double z = pos.getZ() + 0.5 - cam.z;
			if (ghosts) {
				boolean model = BlockDrawer.drawBlock(matrices, consumers, states.get(i), pos, x, y, z, 0.96f + 0.02f * p, 0, alpha, light, 0.75f, 0.95f, 1.0f);
				if (!model || positions.size() <= MAX_OUTLINES) {
					BlockDrawer.drawCubeOutline(matrices, consumers, x, y, z, 1.0f, 0, 0x88FFFFFF, 1.5f);
				}
			}
		}
		drawBounds(matrices, consumers, cam, positions, colorLerp(0xFF3FE0D0, 0xFF9FFFF5, p));
		drawClickedPoints(matrices, consumers, cam, preview.points());
	}

	private static void renderBreak(MatrixStack matrices, VertexConsumerProvider consumers, Vec3d cam, BuildController.Preview preview) {
		List<BlockPos> positions = preview.positions();
		float p = pulse();
		int fill = ((int) (40 + 40 * p) << 24) | 0xFF3030;
		VertexConsumer quads = consumers.getBuffer(RenderLayers.debugQuads());
		int count = 0;
		for (BlockPos pos : positions) {
			if (count++ > MAX_GHOSTS) {
				break;
			}
			float x = (float) (pos.getX() - cam.x);
			float y = (float) (pos.getY() - cam.y);
			float z = (float) (pos.getZ() - cam.z);
			BlockDrawer.fillBox(matrices, quads, x - 0.004f, y - 0.004f, z - 0.004f, x + 1.004f, y + 1.004f, z + 1.004f, fill);
		}
		if (positions.size() <= MAX_OUTLINES) {
			for (BlockPos pos : positions) {
				BlockDrawer.drawCubeOutline(matrices, consumers, pos.getX() + 0.5 - cam.x, pos.getY() + 0.5 - cam.y, pos.getZ() + 0.5 - cam.z, 1.0f, 0, 0xCCFF5050, 1.5f);
			}
		}
		drawBounds(matrices, consumers, cam, positions, colorLerp(0xFFFF4040, 0xFFFFA0A0, p));
		drawClickedPoints(matrices, consumers, cam, preview.points());
	}

	private static void drawBounds(MatrixStack matrices, VertexConsumerProvider consumers, Vec3d cam, List<BlockPos> positions, int color) {
		if (positions.size() < 2) {
			return;
		}
		int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE, minZ = Integer.MAX_VALUE;
		int maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE, maxZ = Integer.MIN_VALUE;
		for (BlockPos pos : positions) {
			minX = Math.min(minX, pos.getX());
			minY = Math.min(minY, pos.getY());
			minZ = Math.min(minZ, pos.getZ());
			maxX = Math.max(maxX, pos.getX());
			maxY = Math.max(maxY, pos.getY());
			maxZ = Math.max(maxZ, pos.getZ());
		}
		BlockDrawer.drawBox(matrices, consumers, minX - cam.x - 0.02, minY - cam.y - 0.02, minZ - cam.z - 0.02,
			maxX + 1 - cam.x + 0.02, maxY + 1 - cam.y + 0.02, maxZ + 1 - cam.z + 0.02, color, 3.0f);
	}

	private static void drawClickedPoints(MatrixStack matrices, VertexConsumerProvider consumers, Vec3d cam, List<BlockPos> points) {
		float spin = (Util.getMeasuringTimeMs() % 4000L) / 4000f * 360f;
		for (int i = 0; i < Math.min(BuildController.step(), points.size()); i++) {
			BlockPos pos = points.get(i);
			BlockDrawer.drawCubeOutline(matrices, consumers, pos.getX() + 0.5 - cam.x, pos.getY() + 0.5 - cam.y, pos.getZ() + 0.5 - cam.z, 0.55f, spin, 0xFFFFD84A, 2.5f);
		}
	}

	private static void renderModifierGuides(MinecraftClient mc, MatrixStack matrices, VertexConsumerProvider consumers, Vec3d cam) {
		Modifiers m = BuildController.modifiers();
		double py = mc.player.getY();
		double px = mc.player.getX();
		double pz = mc.player.getZ();
		float size = 12f;
		VertexConsumer quads = consumers.getBuffer(RenderLayers.debugQuads());
		if (m.mirror()) {
			if (m.mirrorX()) {
				float x = (float) (m.mirrorX2() / 2.0 - cam.x);
				float y0 = (float) (py - size / 2 - cam.y), y1 = y0 + size;
				float z0 = (float) (pz - size - cam.z), z1 = z0 + size * 2;
				BlockDrawer.fillBox(matrices, quads, x - 0.01f, y0, z0, x + 0.01f, y1, z1, 0x30FF5A5A);
				BlockDrawer.drawBox(matrices, consumers, x, y0, z0, x + 0.001, y1, z1, 0xAAFF5A5A, 2f);
			}
			if (m.mirrorY()) {
				float y = (float) (m.mirrorY2() / 2.0 - cam.y);
				float x0 = (float) (px - size - cam.x), x1 = x0 + size * 2;
				float z0 = (float) (pz - size - cam.z), z1 = z0 + size * 2;
				BlockDrawer.fillBox(matrices, quads, x0, y - 0.01f, z0, x1, y + 0.01f, z1, 0x305AFF5A);
				BlockDrawer.drawBox(matrices, consumers, x0, y, z0, x1, y + 0.001, z1, 0xAA5AFF5A, 2f);
			}
			if (m.mirrorZ()) {
				float z = (float) (m.mirrorZ2() / 2.0 - cam.z);
				float y0 = (float) (py - size / 2 - cam.y), y1 = y0 + size;
				float x0 = (float) (px - size - cam.x), x1 = x0 + size * 2;
				BlockDrawer.fillBox(matrices, quads, x0, y0, z - 0.01f, x1, y1, z + 0.01f, 0x305A8CFF);
				BlockDrawer.drawBox(matrices, consumers, x0, y0, z, x1, y1, z + 0.001, 0xAA5A8CFF, 2f);
			}
		}
		if (m.radial() && m.radialSlices() > 1) {
			double x = m.radialX2() / 2.0 - cam.x;
			double z = m.radialZ2() / 2.0 - cam.z;
			double y0 = py - 8 - cam.y;
			BlockDrawer.drawBox(matrices, consumers, x - 0.05, y0, z - 0.05, x + 0.05, y0 + 16, z + 0.05, 0xDDFFD84A, 2.5f);
		}
	}

	private static int colorLerp(int a, int b, float t) {
		int r = (int) MathHelper.lerp(t, (a >> 16) & 0xFF, (b >> 16) & 0xFF);
		int g = (int) MathHelper.lerp(t, (a >> 8) & 0xFF, (b >> 8) & 0xFF);
		int bl = (int) MathHelper.lerp(t, a & 0xFF, b & 0xFF);
		return 0xFF000000 | r << 16 | g << 8 | bl;
	}
}
