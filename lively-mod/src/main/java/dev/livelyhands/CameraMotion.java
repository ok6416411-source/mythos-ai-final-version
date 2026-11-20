package dev.livelyhands;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;
import net.minecraft.util.math.Vec3d;

/** First-person camera feel: slight roll into strafes and a dip when landing. */
public final class CameraMotion {
	private static final Spring ROLL = new Spring();
	private static final Spring DIP = new Spring();
	private static long lastNanos = -1;
	private static boolean wasOnGround = true;
	private static double lastVy;

	private CameraMotion() {
	}

	public static void tick(MinecraftClient mc) {
		ClientPlayerEntity p = mc.player;
		if (p == null) {
			return;
		}
		boolean onGround = p.isOnGround();
		if (onGround && !wasOnGround && lastVy < -0.3) {
			DIP.vel += (float) Math.min(3.0, -lastVy * 4.0);
		}
		wasOnGround = onGround;
		lastVy = p.getVelocity().y;
	}

	public static void apply(MatrixStack matrices, float tickProgress) {
		LivelyConfig c = LivelyConfig.get();
		MinecraftClient mc = MinecraftClient.getInstance();
		ClientPlayerEntity p = mc.player;
		if (!c.enabled || !c.camera || p == null || mc.getCameraEntity() != p || !mc.options.getPerspective().isFirstPerson()) {
			return;
		}
		long now = System.nanoTime();
		float dt = lastNanos < 0 ? 0.016f : Math.min(0.05f, (now - lastNanos) / 1.0e9f);
		lastNanos = now;
		Vec3d v = p.getVelocity();
		double rad = Math.toRadians(p.getYaw(tickProgress));
		double strafe = v.x * Math.cos(rad) + v.z * Math.sin(rad);
		ROLL.update((float) MathHelper.clamp(strafe * 9, -2.2, 2.2), 70, 12, dt);
		DIP.update(0, 110, 10, dt);
		float k = c.cameraIntensity;
		matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(-ROLL.pos * k));
		matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(DIP.pos * 1.6f * k));
		matrices.translate(0, DIP.pos * 0.04f * k, 0);
	}
}
