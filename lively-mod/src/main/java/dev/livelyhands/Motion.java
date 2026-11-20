package dev.livelyhands;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.network.ClientPlayerLikeState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.BlockItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
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
 * walk bob, sprint pose, jump/landing, recoil, breathing); {@link #applyItem} runs right
 * before an item is drawn (swing combos, equip spin, jump flip, eating, inspect, idle fidgets).
 */
public final class Motion {
	private static final Spring YAW = new Spring();
	private static final Spring PITCH = new Spring();
	private static final Spring ROLL = new Spring();
	private static final Spring LEAN = new Spring();
	private static final Spring LIFT = new Spring();
	private static final Spring SNEAK = new Spring();
	private static final Spring RUN = new Spring();
	private static final Spring RECOIL = new Spring();
	private static final Spring PEND_F = new Spring();
	private static final Spring PEND_S = new Spring();
	private static float lastForward;

	private static long lastNanos = -1;
	private static float lastYaw = Float.NaN;
	private static float lastPitch;
	private static float yawLag;
	private static float pitchLag;
	private static boolean wasOnGround = true;
	private static double lastVy;
	private static int lastSlot = -1;
	private static int sprintTicks;
	private static int idleTicks;

	private static long jumpStart = -1;
	private static long inspectStart = -1;
	private static final long INSPECT_MS = 2600;
	private static long fidgetStart = -1;
	private static int fidgetKind;

	private static float prevSwing;
	private static long lastSwingAt;
	private static int combo;

	private Motion() {
	}

	private static LivelyConfig cfg() {
		return LivelyConfig.get();
	}

	public static void startInspect() {
		if (cfg().enabled && cfg().firstPerson && cfg().inspect) {
			inspectStart = Util.getMeasuringTimeMs();
			fidgetStart = -1;
		}
	}

	/** Kick from hitting an entity or breaking a block. */
	public static void recoil(float amount) {
		RECOIL.vel += amount * 9f;
		idleTicks = 0;
	}

	/** Per tick: jumps, landings, sprint time, idle time, cancelling animations. */
	public static void tick(MinecraftClient mc) {
		ClientPlayerEntity player = mc.player;
		if (player == null) {
			return;
		}
		LivelyConfig c = cfg();
		boolean onGround = player.isOnGround();
		double vy = player.getVelocity().y;
		if (wasOnGround && !onGround && vy > 0.2 && !player.isClimbing()) {
			jumpStart = Util.getMeasuringTimeMs();
		}
		if (onGround && !wasOnGround && lastVy < -0.25 && c.jumpAndLanding) {
			float impact = (float) Math.min(3.0, -lastVy * 3.2);
			LIFT.vel -= impact * c.fp();
			if (c.extras() && c.shake) {
				CameraMotion.shake(Math.min(1f, impact * 0.35f));
			}
		}
		wasOnGround = onGround;
		lastVy = vy;
		sprintTicks = player.isSprinting() ? sprintTicks + 1 : 0;

		boolean moving = player.getVelocity().horizontalLengthSquared() > 1.0e-3 || !onGround;
		boolean busy = player.handSwinging || player.isUsingItem() || mc.options.attackKey.isPressed() || mc.options.useKey.isPressed();
		idleTicks = moving || busy ? 0 : idleTicks + 1;

		int slot = player.getInventory().getSelectedSlot();
		if (slot != lastSlot || busy) {
			inspectStart = -1;
			fidgetStart = -1;
		}
		lastSlot = slot;

		// Idle fidgets: every few seconds of standing still the character plays with the item.
		if (c.extras() && c.fidgets && fidgetStart < 0 && inspectStart < 0 && idleTicks > 100 && idleTicks % 140 == 0) {
			fidgetStart = Util.getMeasuringTimeMs();
			fidgetKind = (fidgetKind + 1) % 3;
		}
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
		float k = c.fp();
		boolean wild = c.extras();
		float damping = wild ? 8.5f : 13f;

		// --- Inertia: the item trails behind fast turns, then swings back past the centre.
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
			yawLag = MathHelper.clamp(yawLag + dYaw, -45, 45);
			pitchLag = MathHelper.clamp(pitchLag + dPitch, -45, 45);
			YAW.update(yawLag, 140, damping, dt);
			PITCH.update(pitchLag, 140, damping, dt);
			float decay = (float) Math.exp(-dt * 9);
			yawLag *= decay;
			pitchLag *= decay;
		} else {
			YAW.reset(0);
			PITCH.reset(0);
		}

		// --- Movement tilt and sprint pose.
		Vec3d vel = player.getVelocity();
		double rad = Math.toRadians(yaw);
		double forward = -vel.x * Math.sin(rad) + vel.z * Math.cos(rad);
		double strafe = vel.x * Math.cos(rad) + vel.z * Math.sin(rad);
		ROLL.update(c.movementTilt ? (float) MathHelper.clamp(strafe * 45, -9, 9) : 0, 90, damping, dt);
		LEAN.update(c.movementTilt ? (float) MathHelper.clamp(forward * (player.isSprinting() ? 28 : 14), -6, 7) : 0, 90, damping, dt);
		// After a second of sprinting the item is pulled back like a sprinter's arm (wild styles only).
		RUN.update(wild && c.movementTilt && sprintTicks > 20 ? 1 : 0, 50, 10, dt);

		// --- Vertical: float up while falling, lag down while jumping.
		float liftTarget = c.jumpAndLanding && !player.isOnGround() ? (float) MathHelper.clamp(-vel.y * 0.18, -0.08, 0.12) : 0;
		LIFT.update(liftTarget, 110, wild ? 7 : 10, dt);
		SNEAK.update(player.isInSneakingPose() ? 1 : 0, 120, 18, dt);
		RECOIL.update(0, 160, 14, dt);

		// --- Pendulum for hanging items: turning, speeding up, jumping and walking set it swinging.
		PEND_S.vel += MathHelper.clamp(dYaw, -40, 40) * 9f;
		PEND_F.vel += -MathHelper.clamp(dPitch, -40, 40) * 3f;
		PEND_F.vel += (float) -(forward - lastForward) * 700f;
		lastForward = (float) forward;
		PEND_F.vel += (float) -vel.y * 4f;
		PEND_F.update(0, 30, 2.6f, dt);
		PEND_S.update(0, 30, 2.6f, dt);
		PEND_F.pos = MathHelper.clamp(PEND_F.pos, -70, 70);
		PEND_S.pos = MathHelper.clamp(PEND_S.pos, -70, 70);

		float breathe = 0;
		float breatheRoll = 0;
		if (c.idleBreathing && vel.horizontalLengthSquared() < 1.0e-4) {
			float t = (Util.getMeasuringTimeMs() % 1_000_000L) / 1000f;
			breathe = MathHelper.sin(t * 1.7f) * 0.006f;
			breatheRoll = MathHelper.sin(t * 1.1f) * 0.5f;
		}

		// --- Walking bob: a figure-eight sway, much stronger than vanilla's.
		float bobX = 0, bobY = 0, bobRoll = 0;
		if (c.movementTilt) {
			ClientPlayerLikeState state = player.getState();
			float f = state.getReverseLerpedDistanceMoved(tickProgress) * (float) Math.PI;
			float g = state.lerpMovement(tickProgress);
			bobX = MathHelper.sin(f) * g * 0.07f;
			bobY = -Math.abs(MathHelper.cos(f)) * g * 0.06f;
			bobRoll = MathHelper.sin(f) * g * 4f;
			PEND_S.vel += MathHelper.cos(f) * g * 18f;
		}

		// Square-root response: even the tiniest mouse movement shows, big turns stay controlled.
		float yawShown = amplify(YAW.pos);
		float pitchShown = amplify(PITCH.pos);
		matrices.translate(0, -0.35, -0.6);
		matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(-yawShown * 0.16f * k));
		matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees((-pitchShown * 0.14f + LEAN.pos + SNEAK.pos * 4f + RECOIL.pos * 6f) * k));
		matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees((yawShown * 0.10f - ROLL.pos + breatheRoll + bobRoll) * k));
		matrices.translate(0, 0.35, 0.6);
		matrices.translate(bobX * k, (LIFT.pos + breathe + bobY - SNEAK.pos * 0.035f) * k, (SNEAK.pos * 0.03f + RECOIL.pos * 0.08f) * k);
		if (RUN.pos > 0.001f) {
			float r = RUN.pos * Math.min(1.5f, k);
			matrices.translate(0, -0.08f * r, 0.12f * r);
			matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(30f * r));
		}
	}

	/** Each new swing within 0.7 s advances the combo: 0 → 1 → 2 (finisher) → 0. */
	private static void trackCombo(Hand hand, float swingProgress, long nowMs) {
		if (hand != Hand.MAIN_HAND) {
			return;
		}
		if (swingProgress > 0 && (prevSwing == 0 || swingProgress < prevSwing - 0.05f)) {
			combo = nowMs - lastSwingAt < 700 ? (combo + 1) % 3 : 0;
		}
		if (swingProgress > 0) {
			lastSwingAt = nowMs;
		}
		prevSwing = swingProgress;
	}

	/** Empty hand: jab, hook, uppercut combo instead of vanilla's single punch. */
	public static void applyFist(MatrixStack matrices, float swingProgress, Arm arm) {
		LivelyConfig c = cfg();
		if (!c.enabled || !c.firstPerson || !c.swingStyles) {
			return;
		}
		long nowMs = Util.getMeasuringTimeMs();
		trackCombo(Hand.MAIN_HAND, swingProgress, nowMs);
		if (swingProgress <= 0) {
			return;
		}
		float k = Math.min(c.fp(), 1.8f);
		int side = arm == Arm.RIGHT ? 1 : -1;
		float s = MathHelper.sin(swingProgress * (float) Math.PI);
		float snap = MathHelper.sin(MathHelper.sqrt(swingProgress) * (float) Math.PI);
		int step = c.extras() && c.combos ? combo : 0;
		switch (step) {
			case 1 -> {
				matrices.translate(side * -0.32f * snap * k, 0.06f * s, -0.12f * s * k);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * 40f * snap * k));
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -20f * s * k));
			}
			case 2 -> {
				matrices.translate(side * -0.12f * s, (0.3f * snap - 0.1f * s) * k, -0.18f * s * k);
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-45f * snap * k));
			}
			default -> {
				matrices.translate(side * -0.14f * s, 0.05f * s, -0.42f * snap * k);
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-10f * s * k));
			}
		}
	}

	/** sign(x) * sqrt(|x|) scaled so 1° of lag shows as 3°, 25° as 15°. */
	private static float amplify(float x) {
		return Math.signum(x) * MathHelper.sqrt(Math.abs(x)) * 3f;
	}

	private enum Style { NONE, SLASH, CHOP, PICK, THRUST, PLACE, STAB }

	private static Style style(ItemStack stack) {
		if (stack.isIn(ItemTags.SWORDS)) return Style.SLASH;
		if (stack.isIn(ItemTags.AXES)) return Style.CHOP;
		if (stack.isIn(ItemTags.PICKAXES)) return Style.PICK;
		if (stack.isIn(ItemTags.SHOVELS) || stack.isIn(ItemTags.HOES)) return Style.THRUST;
		if (stack.isOf(Items.TRIDENT) || stack.isOf(Items.MACE)) return Style.STAB;
		if (stack.getItem() instanceof BlockItem) return Style.PLACE;
		return Style.NONE;
	}

	private static float ease(float t) {
		t = MathHelper.clamp(t, 0, 1);
		return t * t * (3 - 2 * t);
	}

	/** Applied right before vanilla draws one held item. */
	public static void applyItem(MatrixStack matrices, PlayerEntity player, Hand hand, ItemStack stack, float swingProgress, float equipProgress, float tickProgress) {
		LivelyConfig c = cfg();
		if (!c.enabled || !c.firstPerson || stack.isEmpty()) {
			return;
		}
		float k = c.fp();
		boolean wild = c.extras();
		long nowMs = Util.getMeasuringTimeMs();
		Arm arm = hand == Hand.MAIN_HAND ? player.getMainArm() : player.getMainArm().getOpposite();
		int side = arm == Arm.RIGHT ? 1 : -1;
		boolean using = player.isUsingItem() && player.getActiveHand() == hand;
		Style style = style(stack);

		trackCombo(hand, swingProgress, nowMs);
		int step = wild && c.combos ? combo : 0;

		// --- Equip: the new item flips up into the hand; in wild styles it also spins in.
		if (c.equipFlip && equipProgress > 0.001f) {
			float e = equipProgress * equipProgress;
			matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-55f * e * Math.min(k, 1.6f)));
			matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * 30f * e * Math.min(k, 1.6f)));
			if (wild) {
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * 360f * e));
			}
		}

		// --- Holding poses per item, like a real hand would hold them.
		if (!using && swingProgress <= 0) {
			if (stack.isOf(Items.TORCH) || stack.isOf(Items.SOUL_TORCH) || stack.isOf(Items.REDSTONE_TORCH) || stack.isOf(Items.COPPER_TORCH)
				|| stack.isOf(Items.LANTERN) || stack.isOf(Items.SOUL_LANTERN)) {
				// Light raised up and towards the middle, flickering slightly.
				float flicker = MathHelper.sin((nowMs % 100000L) / 1000f * 7f) * 0.6f;
				matrices.translate(side * -0.1f, 0.12f, -0.06f);
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(12f + flicker));
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -6f));
			} else if (stack.getUseAction() == UseAction.EAT || stack.getUseAction() == UseAction.DRINK) {
				matrices.translate(side * -0.06f, 0.03f, 0.04f);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * -12f));
			} else if (style == Style.PLACE) {
				// Blocks are carried a bit lower and more in front, like holding something heavy.
				matrices.translate(side * -0.07f, -0.04f, -0.04f);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * -10f));
			} else if (stack.isOf(Items.SHIELD)) {
				matrices.translate(side * -0.05f, 0, -0.05f);
			} else if (stack.isOf(Items.TOTEM_OF_UNDYING)) {
				matrices.translate(side * -0.12f, 0.14f, -0.05f);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(MathHelper.sin((nowMs % 100000L) / 1000f * 2f) * 12f));
			}
		}

		// --- Jump flip: the item does a backflip in the hand when you jump.
		if (wild && c.flips && jumpStart >= 0 && !using) {
			float t = (nowMs - jumpStart) / 520f;
			if (t >= 1) {
				jumpStart = -1;
			} else {
				float lift = MathHelper.sin(t * (float) Math.PI);
				matrices.translate(0, 0.12f * lift, 0);
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(360f * ease(t)));
			}
		}

		// --- Swing styles per tool, added on top of the vanilla swing.
		if (c.swingStyles && swingProgress > 0 && !using) {
			float kk = Math.min(k, 1.8f);
			float s = MathHelper.sin(swingProgress * (float) Math.PI);
			float snap = MathHelper.sin(MathHelper.sqrt(swingProgress) * (float) Math.PI);
			int dir = step == 1 ? -1 : 1;
			switch (style) {
				case SLASH -> {
					if (step == 2) {
						// Finisher: overhead slam with a full spin of the blade.
						matrices.translate(side * -0.1f * s, 0.18f * s, -0.1f * s);
						matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-55f * snap * kk));
						matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -360f * ease(swingProgress)));
					} else {
						matrices.translate(side * dir * -0.16f * s * kk, 0.05f * s * kk, 0);
						matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * dir * -40f * snap * kk));
						matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * dir * 28f * s * kk));
					}
				}
				case CHOP -> {
					matrices.translate(0, 0.08f * s * kk, 0);
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-40f * snap * kk));
					if (step == 2) {
						matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-360f * ease(swingProgress)));
					} else if (step == 1) {
						matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * 30f * s * kk));
					}
				}
				case PICK -> {
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-28f * snap * kk));
					matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -18f * s * kk));
				}
				case THRUST -> {
					matrices.translate(0, 0, -0.28f * s * kk);
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(14f * s * kk));
				}
				case STAB -> {
					matrices.translate(0, -0.05f * s, -0.35f * s * kk);
					if (step == 2) {
						matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * 360f * ease(swingProgress)));
					}
				}
				case PLACE -> {
					matrices.translate(0, 0.06f * s * kk, -0.18f * s * kk);
					matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-18f * s * kk));
					if (wild) {
						matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * 25f * s));
					}
				}
				default -> {
					// Anything else: alternating swipes, third hit spins the item.
					matrices.translate(side * dir * -0.1f * s * kk, 0.04f * s, 0);
					matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * dir * -25f * snap * kk));
					if (step == 2) {
						matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -360f * ease(swingProgress)));
					}
				}
			}
		}

		// --- Eating / drinking: chewing shake on top of vanilla's bobbing.
		if (c.eatingWobble && using) {
			UseAction action = stack.getUseAction();
			if (action == UseAction.EAT || action == UseAction.DRINK) {
				float t = (nowMs % 1_000_000L) / 1000f;
				float speed = action == UseAction.EAT ? 17f : 9f;
				matrices.translate(0, Math.abs(MathHelper.sin(t * speed * 0.5f)) * 0.025f * k, 0);
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(MathHelper.sin(t * speed) * 3.5f * k));
			} else if (action == UseAction.BOW || action == UseAction.SPEAR || action == UseAction.CROSSBOW) {
				// Straining: the drawn weapon trembles.
				float t = (nowMs % 1_000_000L) / 1000f;
				float tremble = Math.min(1f, player.getItemUseTime() / 20f) * 0.6f * k;
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(MathHelper.sin(t * 55f) * tremble));
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(MathHelper.sin(t * 43f) * tremble));
			}
		}

		Hanging.Kind hanging = Hanging.kind(stack);
		if (hanging != Hanging.Kind.NONE) {
			Hanging.swingFirstPerson(matrices, hanging, PEND_F.pos * Math.min(k, 1.6f), PEND_S.pos * Math.min(k, 1.6f));
		}

		if (hand != Hand.MAIN_HAND || using) {
			return;
		}

		// --- Inspect: bring the item to the centre, turn it, (wild) toss it up and catch it.
		if (inspectStart >= 0) {
			float p = (nowMs - inspectStart) / (float) INSPECT_MS;
			if (p >= 1) {
				inspectStart = -1;
			} else {
				float bell = ease(p / 0.18f) * (1 - ease((p - 0.82f) / 0.18f));
				float turn = ease((p - 0.15f) / 0.4f);
				matrices.translate(side * -0.28f * bell, 0.14f * bell, 0.12f * bell);
				matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * (-40f * bell + 360f * turn)));
				matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(18f * bell));
				matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * -16f * bell));
				if (wild) {
					float toss = MathHelper.clamp((p - 0.56f) / 0.26f, 0, 1);
					if (toss > 0 && toss < 1) {
						matrices.translate(0, 0.55f * 4 * toss * (1 - toss), 0);
						matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-720f * ease(toss)));
					}
				}
			}
		}

		// --- Idle fidgets: twirl, toss, or a quick spin of the wrist.
		if (fidgetStart >= 0) {
			float p = (nowMs - fidgetStart) / 1500f;
			if (p >= 1) {
				fidgetStart = -1;
			} else {
				float bell = MathHelper.sin(p * (float) Math.PI);
				switch (fidgetKind) {
					case 0 -> {
						matrices.translate(side * -0.1f * bell, 0.08f * bell, 0);
						matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(side * 720f * ease(p)));
					}
					case 1 -> {
						matrices.translate(0, 0.6f * 4 * p * (1 - p), 0);
						matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-360f * ease(p)));
					}
					default -> {
						matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(side * 360f * ease(p)));
						matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(-25f * bell));
					}
				}
			}
		}
	}
}
