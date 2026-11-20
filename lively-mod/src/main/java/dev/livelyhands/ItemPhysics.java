package dev.livelyhands;

import net.fabricmc.fabric.api.client.rendering.v1.RenderStateDataKey;
import net.minecraft.client.render.entity.state.ItemEntityRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.ItemEntity;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.RotationAxis;

/**
 * Dropped items behave like objects: flat items lie on the ground, blocks sit on a face,
 * and while flying everything tumbles. Replaces vanilla's floating bob and spin.
 */
public final class ItemPhysics {
	public record Data(boolean onGround, boolean inWater, float spinSpeed, float bounce) {
	}

	private static final class Track {
		final Spring bounce = new Spring();
		boolean wasOnGround;
		double lastVy;
		long lastNanos = -1;
		long seen;
	}

	private static final java.util.Map<Integer, Track> TRACKS = new java.util.HashMap<>();
	private static long lastCleanup;

	public static final RenderStateDataKey<Data> DATA = RenderStateDataKey.create(() -> "livelyhands:item");

	private ItemPhysics() {
	}

	public static boolean active() {
		LivelyConfig c = LivelyConfig.get();
		return c.enabled && c.itemPhysics;
	}

	public static void update(ItemEntity entity, ItemEntityRenderState state) {
		if (!active()) {
			state.setData(DATA, null);
			return;
		}
		float speed = (float) entity.getVelocity().length();
		long nowNs = System.nanoTime();
		long nowMs = net.minecraft.util.Util.getMeasuringTimeMs();
		Track t = TRACKS.computeIfAbsent(entity.getId(), id -> new Track());
		float dt = t.lastNanos < 0 ? 0.016f : Math.min(0.05f, (nowNs - t.lastNanos) / 1.0e9f);
		t.lastNanos = nowNs;
		t.seen = nowMs;
		boolean onGround = entity.isOnGround();
		if (onGround && !t.wasOnGround && t.lastVy < -0.08 && LivelyConfig.get().extras()) {
			// Hop back up a little when it hits the ground.
			t.bounce.vel += (float) Math.min(6.0, -t.lastVy * 18.0);
		}
		t.wasOnGround = onGround;
		t.lastVy = entity.getVelocity().y;
		t.bounce.update(0, 90, 7, dt);
		if (nowMs - lastCleanup > 10_000) {
			lastCleanup = nowMs;
			TRACKS.values().removeIf(tr -> tr.seen < nowMs - 10_000);
		}
		state.setData(DATA, new Data(onGround, entity.isTouchingWater(), speed, Math.max(0, t.bounce.pos)));
	}

	/**
	 * Replaces vanilla's bob + spin. Returns false if vanilla should handle this item.
	 */
	public static boolean transform(MatrixStack matrices, ItemEntityRenderState state, Box box) {
		Data d = state.getData(DATA);
		if (d == null) {
			return false;
		}
		boolean flat = box.getLengthZ() <= 0.0626;
		float seedYaw = state.uniqueOffset * 57.29578f;
		if (d.onGround() && !d.inWater()) {
			if (d.bounce() > 0.001f) {
				matrices.translate(0, d.bounce() * 0.12f, 0);
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(d.bounce() * 25f));
			}
			if (flat) {
				// Lie flat; the stack copies (offset along Z) then pile upwards.
				matrices.translate(0, 0.02f, 0);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(seedYaw));
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-90));
				float len = (float) box.getLengthZ();
				matrices.translate(0, 0, (float) -box.minZ + len * 1.5f * Math.max(0, state.renderedAmount - 1) / 2f);
			} else {
				matrices.translate(0, (float) -box.minY, 0);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(seedYaw));
			}
		} else {
			float lift = (float) -box.minY + 0.0625f;
			float t = state.age;
			float tumble = d.inWater() ? 2.5f : 9f;
			matrices.translate(0, lift, 0);
			matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(seedYaw + t * tumble * 0.6f));
			matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(t * tumble));
			matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(t * tumble * 0.4f));
		}
		return true;
	}
}
