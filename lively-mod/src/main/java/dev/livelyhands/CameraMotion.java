package dev.livelyhands;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;
import net.minecraft.util.math.Vec3d;

/** First-person camera feel: roll into strafes, dip on landing, and screen shake on impacts. */
public final class CameraMotion {
	private static final Spring ROLL = new Spring();
	private static final Spring DIP = new Spring();
	private static long lastNanos = -1;
	private static boolean wasOnGround = true;
	private static double lastVy;
	private static float trauma;
	private static float shakeTime;

	private CameraMotion() {
	}

	/** Adds screen shake; 0.2 = light tap, 1.0 = heavy slam. */
	public static void shake(float amount) {
		LivelyConfig c = LivelyConfig.get();
		if (c.enabled && c.camera && c.shake && c.extras()) {
			trauma = Math.min(1f, trauma + amount);
		}
	}

	public static void tick(MinecraftClient mc) {
		ClientPlayerEntity p = mc.player;
		if (p == null) {
			return;
		}
		boolean onGround = p.isOnGround();
		if (onGround && !wasOnGround && lastVy < -0.3) {
			DIP.vel += (float) Math.min(3.5, -lastVy * 4.5);
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
		DIP.update(0, 110, 9, dt);
		float k = Math.min(c.cam(), 2.0f);
		matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(-ROLL.pos * k));
		matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(DIP.pos * 1.8f * k));
		matrices.translate(0, DIP.pos * 0.05f * k, 0);

		if (trauma > 0.001f) {
			shakeTime += dt;
			float s = trauma * trauma * 3.2f;
			float t = shakeTime * 38f;
			matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees((MathHelper.sin(t * 1.3f) + MathHelper.sin(t * 2.9f) * 0.5f) * s));
			matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees((MathHelper.sin(t * 1.7f + 1f) + MathHelper.sin(t * 3.3f) * 0.4f) * s * 0.7f));
			matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(MathHelper.sin(t * 2.3f + 2f) * s * 0.6f));
			trauma = Math.max(0, trauma - dt * 1.8f);
		}
	}
}
