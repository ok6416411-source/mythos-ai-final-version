package dev.livelyhands;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.BlockItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.consume.UseAction;
import net.minecraft.registry.tag.ItemTags;
import net.minecraft.util.Arm;
import net.minecraft.util.Hand;
import net.minecraft.util.Util;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;
import net.minecraft.util.math.Vec3d;

/**
 * All first-person motion. {@link #applyGlobal} runs once per frame for both hands (inertia,
 * movement tilt, jump/landing, sneaking, breathing); {@link #applyItem} runs right before an
 * item is drawn (swing style, equip flip, eating wobble, inspect).
 */
public final class Motion {
	private static final Spring YAW = new Spring();
	private static final Spring PITCH = new Spring();
	private static final Spring ROLL = new Spring();
	private static final Spring LEAN = new Spring();
	private static final Spring LIFT = new Spring();
	private static final Spring SNEAK = new Spring();

	private static long lastNanos = -1;
	private static float lastYaw = Float.NaN;
	private static float lastPitch;
	private static float yawLag;
	private static float pitchLag;
	private static boolean wasOnGround = true;
	private static double lastVy;
	private static int lastSlot = -1;

	private static long inspectStart = -1;
	private static final long INSPECT_MS = 2200;

	private Motion() {
	}

	private static LivelyConfig cfg() {
		return LivelyConfig.get();
	}

	public static void startInspect() {
		if (cfg().enabled && cfg().inspect) {
			inspectStart = Util.getMeasuringTimeMs();
		}
	}

	/** Per tick: landing impact and cancelling the inspect animation. */
	public static void tick(MinecraftClient mc) {
		ClientPlayerEntity player = mc.player;
		if (player == null) {
			return;
		}
		boolean onGround = player.isOnGround();
		if (onGround && !wasOnGround && lastVy < -0.25 && cfg().jumpAndLanding) {
			// Kick the lift spring downwards: the item dips and bounces back.
			LIFT.vel -= (float) Math.min(2.5, -lastVy * 3.0) * cfg().intensity;
		}
		wasOnGround = onGround;
		lastVy = player.getVelocity().y;
		int slot = player.getInventory().getSelectedSlot();
		if (slot != lastSlot || player.handSwinging || player.isUsingItem()) {
			inspectStart = -1;
		}
		lastSlot = slot;
	}

	/** Applied once per frame before vanilla draws the hands. */
	public static void applyGlobal(MatrixStack matrices, ClientPlayerEntity player, float tickProgress) {
		LivelyConfig c = cfg();
		if (!c.enabled || !c.firstPerson) {
			return;
		}
		long now = System.nanoTime();
		float dt = lastNanos < 0 ? 0.016f : Math.min(0.05f, (now - lastNanos) / 1.0e9f);
		lastNanos = now;
		float k = c.intensity;

		// --- Inertia: the item trails behind fast turns, then settles with a small overshoot.
		float yaw = player.getYaw(tickProgress);
		float pitch = player.getPitch(tickProgress);
		if (Float.isNaN(lastYaw)) {
			lastYaw = yaw;
			lastPitch = pitch;
		}
		float dYaw = MathHelper.wrapDegrees(yaw - lastYaw);
		float dPitch = pitch - lastPitch;
		lastYaw = yaw;
		lastPitch = pitch;
		if (c.inertia) {
			yawLag = MathHelper.clamp(yawLag + dYaw, -40, 40);
			pitchLag = MathHelper.clamp(pitchLag + dPitch, -40, 40);
			YAW.update(yawLag, 140, 13, dt);
			PITCH.update(pitchLag, 140, 13, dt);
			// The lag itself decays towards zero, the springs make the return wobbly.
			float decay = (float) Math.exp(-dt * 9);
			yawLag *= decay;
			pitchLag *= decay;
		} else {
			YAW.reset(0);
			PITCH.reset(0);
		}

		// --- Movement: lean into strafing, tilt forward while sprinting.
		Vec3d vel = player.getVelocity();
		double rad = Math.toRadians(yaw);
		double forward = -vel.x * Math.sin(rad) + vel.z * Math.cos(rad);
		double strafe = vel.x * Math.cos(rad) + vel.z * Math.sin(rad);
		float rollTarget = c.movementTilt ? (float) MathHelper.clamp(strafe * 45, -9, 9) : 0;
		float leanTarget = c.movementTilt ? (float) MathHelper.clamp(forward * (player.isSprinting() ? 28 : 14), -6, 7) : 0;
		ROLL.update(rollTarget, 90, 12, dt);
		LEAN.update(leanTarget, 90, 12, dt);

		// --- Vertical: the item floats up while falling and lags down while jumping.
		float liftTarget = c.jumpAndLanding && !player.isOnGround() ? (float) MathHelper.clamp(-vel.y * 0.18, -0.08, 0.12) : 0;
		LIFT.update(liftTarget, 110, 10, dt);

		SNEAK.update(player.isInSneakingPose() ? 1 : 0, 120, 18, dt);

		float breathe = 0;
		float breatheRoll = 0;
		if (c.idleBreathing && vel.horizontalLengthSquared() < 1.0e-4) {
			float t = (Util.getMeasuringTimeMs() % 1_000_000L) / 1000f;
			breathe = MathHelper.sin(t * 1.7f) * 0.006f;
			breatheRoll = MathHelper.sin(t * 1.1f) * 0.5f;
		}

		// Pivot roughly between the hands so rotations look like the arms move, not the screen.
		matrices.translate(0, -0.35, -0.6);
		matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(-YAW.pos * 0.16f * k));
		matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees((-PITCH.pos * 0.14f + LEAN.pos + SNEAK.pos * 4f) * k));
		matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees((YAW.pos * 0.10f - ROLL.pos + breatheRoll) * k));
		matrices.translate(0, 0.35, 0.6);
		matrices.translate(0, (LIFT.pos + breathe - SNEAK.pos * 0.035f) * k, SNEAK.pos * 0.03f * k);
	}

	private enum Style { NONE, SLASH, CHOP, PICK, THRUST, PLACE }

	private static Style style(ItemStack stack) {
		if (stack.isIn(ItemTags.SWORDS)) return Style.SLASH;
		if (stack.isIn(ItemTags.AXES)) return Style.CHOP;
		if (stack.isIn(ItemTags.PICKAXES)) return Style.PICK;
		if (stack.isIn(ItemTags.SHOVELS) || stack.isIn(ItemTags.HOES)) return Style.THRUST;
		if (stack.getItem() instanceof BlockItem) return Style.PLACE;
		return Style.NONE;
	}

	/** Applied right before vanilla draws one held item. */
	public static void applyItem(MatrixStack matrices, PlayerEntity player, Hand hand, ItemStack stack, float swingProgress, float equipProgress, float tickProgress) {
		LivelyConfig c = cfg();
		if (!c.enabled || !c.firstPerson || stack.isEmpty()) {
			return;
		}
		float k = c.intensity;
		Arm arm = hand == Hand.MAIN_HAND ? player.getMainArm() : player.getMainArm().getOpposite();
		int side = arm == Arm.RIGHT ? 1 : -1;
		boolean using = player.isUsingItem() && player.getActiveHand() == hand;

		// --- Equip: the new item flips up into the hand instead of only sliding in.
		if (c.equipFlip && equipProgress > 0.001f) {
			float e = equipProgress * equipProgress;
			matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-55f * e * k));
			matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * 30f * e * k));
		}

		// --- Swing styles per tool, added on top of the vanilla swing.
		if (c.swingStyles && swingProgress > 0 && !using) {
			float s = MathHelper.sin(swingProgress * (float) Math.PI);
			float snap = MathHelper.sin(MathHelper.sqrt(swingProgress) * (float) Math.PI);
			switch (style(stack)) {
				case SLASH -> {
					matrices.translate(side * -0.12f * s * k, 0.04f * s * k, 0);
					matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * -32f * snap * k));
					matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * 22f * s * k));
				}
				case CHOP -> {
					matrices.translate(0, 0.06f * s * k, 0);
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-34f * snap * k));
				}
				case PICK -> {
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-22f * snap * k));
					matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -14f * s * k));
				}
				case THRUST -> {
					matrices.translate(0, 0, -0.22f * s * k);
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(10f * s * k));
				}
				case PLACE -> {
					matrices.translate(0, 0.05f * s * k, -0.14f * s * k);
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-14f * s * k));
				}
				default -> {
				}
			}
		}

		// --- Eating / drinking: chewing wobble on top of vanilla's bobbing.
		if (c.eatingWobble && using) {
			UseAction action = stack.getUseAction();
			if (action == UseAction.EAT || action == UseAction.DRINK) {
				float t = (Util.getMeasuringTimeMs() % 1_000_000L) / 1000f;
				float speed = action == UseAction.EAT ? 17f : 9f;
				matrices.translate(0, Math.abs(MathHelper.sin(t * speed * 0.5f)) * 0.025f * k, 0);
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(MathHelper.sin(t * speed) * 3.5f * k));
			}
		}

		// --- Inspect: bring the item to the centre, turn it once and put it back.
		if (inspectStart >= 0 && hand == Hand.MAIN_HAND && !using) {
			float p = (Util.getMeasuringTimeMs() - inspectStart) / (float) INSPECT_MS;
			if (p >= 1) {
				inspectStart = -1;
			} else {
				float bell = smooth(Math.min(1, p / 0.22f)) * (1 - smooth(Math.max(0, (p - 0.78f) / 0.22f)));
				float turn = smooth(MathHelper.clamp((p - 0.18f) / 0.64f, 0, 1));
				matrices.translate(side * -0.28f * bell, 0.14f * bell, 0.12f * bell);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * (-40f * bell + 360f * turn)));
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(18f * bell));
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -16f * bell));
			}
		}
	}

	private static float smooth(float t) {
		t = MathHelper.clamp(t, 0, 1);
		return t * t * (3 - 2 * t);
	}
}
