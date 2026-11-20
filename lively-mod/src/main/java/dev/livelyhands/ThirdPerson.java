package dev.livelyhands;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import net.fabricmc.fabric.api.client.rendering.v1.RenderStateDataKey;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.entity.model.BipedEntityModel;
import net.minecraft.client.render.entity.state.BipedEntityRenderState;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.BlockItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.item.consume.UseAction;
import net.minecraft.registry.tag.ItemTags;
import net.minecraft.util.Arm;
import net.minecraft.util.Hand;
import net.minecraft.util.Util;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Full-body animations for every player (you in F5 and everybody else) and their armour:
 * item-specific holding poses, torso twist, big walking swing, sprint lean and "anime run",
 * jump tuck, sprint-jump front flip, skydive fall, superhero landing, ladder climbing, eating,
 * hurt flinch, weapon combos with a spinning finisher and idle fidgets. Client-side only.
 */
public final class ThirdPerson {
	/** Per-entity motion values, attached to the render state. */
	public record Pose(float sprint, float rise, float fall, float land, float climb, float hurt, float speed,
		boolean eating, float flip, float anime, int combo, float idle, float swingForward, float swingSide) {
	}

	public static final RenderStateDataKey<Pose> POSE = RenderStateDataKey.create(() -> "livelyhands:pose");

	private static final class Track {
		final Spring sprint = new Spring();
		final Spring air = new Spring();
		final Spring land = new Spring();
		final Spring climb = new Spring();
		final Spring hurt = new Spring();
		final Spring anime = new Spring();
		final Spring pendForward = new Spring();
		final Spring pendSide = new Spring();
		float lastBodyYaw = Float.NaN;
		float lastForward;
		boolean wasOnGround = true;
		double lastY = Double.NaN;
		double lastVy;
		long lastNanos = -1;
		long seen;
		float sprintTime;
		float idleTime;
		long flipStart = -1;
		float prevSwing;
		long lastSwingAt;
		int combo;
	}

	private static final Map<Integer, Track> TRACKS = new HashMap<>();
	private static long lastCleanup;

	private ThirdPerson() {
	}

	/** Called while the render state is being filled, where the entity itself is still available. */
	public static void update(LivingEntity entity, BipedEntityRenderState state, float tickProgress) {
		LivelyConfig c = LivelyConfig.get();
		if (!c.enabled || !c.thirdPerson) {
			state.setData(POSE, null);
			return;
		}
		long nowNs = System.nanoTime();
		long nowMs = Util.getMeasuringTimeMs();
		Track t = TRACKS.computeIfAbsent(entity.getId(), id -> new Track());
		float dt = t.lastNanos < 0 ? 0.016f : Math.min(0.05f, (nowNs - t.lastNanos) / 1.0e9f);
		t.lastNanos = nowNs;
		t.seen = nowMs;
		boolean wild = c.extras();

		// Other players' velocity is not synced reliably, so derive vertical speed from position.
		double y = entity.getY();
		double vy = Double.isNaN(t.lastY) || dt <= 0 ? 0 : (y - t.lastY) / (dt * 20.0);
		t.lastY = y;
		boolean onGround = entity.isOnGround();
		if (onGround && !t.wasOnGround && t.lastVy < -0.3) {
			t.land.vel += (float) Math.min(5.0, -t.lastVy * 6.0);
		}
		if (!onGround && t.wasOnGround && vy > 0.15 && entity.isSprinting() && wild && c.flips && !entity.isClimbing()) {
			t.flipStart = nowMs;
		}
		t.wasOnGround = onGround;
		t.lastVy = vy;

		Vec3d v = entity.getVelocity();
		float horizontal = (float) Math.sqrt(v.x * v.x + v.z * v.z);
		t.sprintTime = entity.isSprinting() ? t.sprintTime + dt : 0;
		boolean still = horizontal < 0.02 && onGround && entity.getHandSwingProgress(tickProgress) == 0 && !entity.isUsingItem();
		t.idleTime = still ? t.idleTime + dt : 0;

		t.sprint.update(entity.isSprinting() ? 1 : 0, 60, 12, dt);
		float airTarget = onGround || entity.isClimbing() || entity.isTouchingWater() ? 0 : (float) MathHelper.clamp(vy * 2.5, -1, 1);
		t.air.update(airTarget, 70, 11, dt);
		t.land.update(0, 110, wild ? 7 : 9, dt);
		t.climb.update(entity.isClimbing() && !onGround ? 1 : 0, 60, 12, dt);
		t.hurt.update(entity.hurtTime > 0 ? 1 : 0, 200, 16, dt);
		t.anime.update(wild && t.sprintTime > 1.2f ? 1 : 0, 40, 10, dt);

		float swing = entity.getHandSwingProgress(tickProgress);
		if (swing > 0 && (t.prevSwing == 0 || swing < t.prevSwing - 0.05f)) {
			t.combo = nowMs - t.lastSwingAt < 700 ? (t.combo + 1) % 3 : 0;
		}
		if (swing > 0) {
			t.lastSwingAt = nowMs;
		}
		t.prevSwing = swing;

		// Pendulum for hanging items (buckets, lanterns): driven by turning, speeding up and landing.
		float bodyYaw = entity.getBodyYaw();
		if (Float.isNaN(t.lastBodyYaw)) {
			t.lastBodyYaw = bodyYaw;
		}
		float yawRate = dt > 0 ? MathHelper.wrapDegrees(bodyYaw - t.lastBodyYaw) / dt : 0;
		t.lastBodyYaw = bodyYaw;
		double rad = Math.toRadians(bodyYaw);
		float fwd = (float) (-v.x * Math.sin(rad) + v.z * Math.cos(rad));
		if (dt > 0) {
			t.pendForward.vel += -(fwd - t.lastForward) * 900f;
			t.pendSide.vel += MathHelper.clamp(yawRate, -720, 720) * 0.35f * dt * 20f;
		}
		t.lastForward = fwd;
		if (onGround && !t.wasOnGround) {
			t.pendForward.vel += 60f;
		}
		t.pendForward.vel += MathHelper.sin(entity.limbAnimator.getAnimationProgress() * 0.6662f) * horizontal * 30f;
		t.pendForward.update(0, 28, 2.4f, dt);
		t.pendSide.update(0, 28, 2.4f, dt);
		t.pendForward.pos = MathHelper.clamp(t.pendForward.pos, -75, 75);
		t.pendSide.pos = MathHelper.clamp(t.pendSide.pos, -75, 75);

		float flip = -1;
		if (t.flipStart >= 0) {
			flip = (nowMs - t.flipStart) / 560f;
			if (flip >= 1 || entity.isOnGround() && flip > 0.3f) {
				t.flipStart = -1;
				flip = -1;
			}
		}

		boolean eating = false;
		if (entity.isUsingItem()) {
			UseAction action = entity.getActiveItem().getUseAction();
			eating = action == UseAction.EAT || action == UseAction.DRINK;
		}
		state.setData(POSE, new Pose(t.sprint.pos, Math.max(0, t.air.pos), Math.max(0, -t.air.pos), t.land.pos, t.climb.pos,
			t.hurt.pos, horizontal, eating, flip, t.anime.pos, wild && c.combos ? t.combo : 0, wild && c.fidgets ? t.idleTime : 0,
			t.pendForward.pos * c.tp() * 0.6f, t.pendSide.pos * c.tp() * 0.6f));

		if (nowMs - lastCleanup > 10_000) {
			lastCleanup = nowMs;
			for (Iterator<Track> it = TRACKS.values().iterator(); it.hasNext(); ) {
				if (it.next().seen < nowMs - 10_000) {
					it.remove();
				}
			}
		}
	}

	private enum Hold { NONE, HANG, LIGHT, BLOCK, FOOD, ROD, BOW, SHIELD, WEAPON, TOTEM }

	private static Hold hold(ItemStack s) {
		if (s.isEmpty()) return Hold.NONE;
		if (Hanging.kind(s) != Hanging.Kind.NONE) return Hold.HANG;
		if (s.isOf(Items.TORCH) || s.isOf(Items.SOUL_TORCH) || s.isOf(Items.REDSTONE_TORCH) || s.isOf(Items.LANTERN)
			|| s.isOf(Items.SOUL_LANTERN) || s.isOf(Items.COPPER_TORCH) || s.isOf(Items.GLOWSTONE_DUST)) return Hold.LIGHT;
		if (s.isOf(Items.TOTEM_OF_UNDYING)) return Hold.TOTEM;
		if (s.isOf(Items.SHIELD)) return Hold.SHIELD;
		if (s.isOf(Items.FISHING_ROD) || s.isOf(Items.CARROT_ON_A_STICK) || s.isOf(Items.WARPED_FUNGUS_ON_A_STICK)) return Hold.ROD;
		if (s.isOf(Items.BOW) || s.isOf(Items.CROSSBOW)) return Hold.BOW;
		if (s.isIn(ItemTags.SWORDS) || s.isIn(ItemTags.AXES) || s.isOf(Items.TRIDENT) || s.isOf(Items.MACE)) return Hold.WEAPON;
		if (s.getItem() instanceof BlockItem) return Hold.BLOCK;
		UseAction a = s.getUseAction();
		if (a == UseAction.EAT || a == UseAction.DRINK) return Hold.FOOD;
		return Hold.NONE;
	}

	/** Called after vanilla has posed the model. All values are radians / model pixels. */
	public static void apply(BipedEntityModel<?> model, BipedEntityRenderState state) {
		Pose p = state.getData(POSE);
		if (p == null || state.isSwimming || state.isGliding || state.hasVehicle || state.sleepingDirection != null) {
			return;
		}
		LivelyConfig c = LivelyConfig.get();
		float k = c.tp();
		float kk = Math.min(k, 1.6f);
		boolean wild = c.extras();
		float age = state.age;
		float limb = state.limbSwingAnimationProgress;
		float amp = Math.min(1f, state.limbSwingAmplitude);
		ModelPart root = model.getRootPart();
		float sp = state.handSwingProgress;
		boolean busy = sp > 0 || state.isUsingItem || p.eating();

		// --- Breathing, big walking swing and bounce: every step is visible.
		float breathe = MathHelper.sin(age * 0.09f);
		model.body.pitch += breathe * 0.02f * kk;
		model.head.pitch -= breathe * 0.015f * kk;
		model.rightArm.roll += (0.04f + breathe * 0.03f) * kk;
		model.leftArm.roll -= (0.04f + breathe * 0.03f) * kk;
		float stride = MathHelper.cos(limb * 0.6662f);
		model.rightArm.pitch += -stride * amp * 0.35f * kk;
		model.leftArm.pitch += stride * amp * 0.35f * kk;
		model.rightLeg.pitch += stride * amp * 0.25f * kk;
		model.leftLeg.pitch += -stride * amp * 0.25f * kk;
		root.originY += Math.abs(MathHelper.cos(limb * 0.6662f)) * amp * -1.2f * kk;
		model.body.roll += MathHelper.sin(limb * 0.6662f) * amp * 0.06f * kk;
		model.head.pitch += MathHelper.sin(limb * 1.3324f) * amp * 0.06f * kk;

		// --- Torso follows the head, like turning the shoulders.
		float twist = MathHelper.clamp(state.relativeHeadYaw * MathHelper.RADIANS_PER_DEGREE * 0.25f, -0.4f, 0.4f) * kk;
		if (sp <= 0) {
			model.body.yaw += twist;
			model.head.yaw -= twist * 0.5f;
			placeArmsOnBody(model);
			model.rightArm.yaw += twist;
			model.leftArm.yaw += twist;
		}

		// --- Item-specific holding poses (both hands).
		if (!busy && p.climb() < 0.5f && p.fall() < 0.3f) {
			holdPose(model, state, Arm.RIGHT, k);
			holdPose(model, state, Arm.LEFT, k);
		}

		// --- Sprint lean and, after a while, the arms-back "anime run".
		float lean = p.sprint() * (0.22f + 0.12f * p.anime()) * kk;
		if (lean > 0.001f && !state.isInSneakingPose) {
			model.body.pitch += lean;
			float dz = 12f * MathHelper.sin(lean);
			float dy = 12f * (1 - MathHelper.cos(lean));
			model.rightLeg.originZ += dz;
			model.leftLeg.originZ += dz;
			model.rightLeg.originY -= dy;
			model.leftLeg.originY -= dy;
			model.rightArm.originZ += 2f * MathHelper.sin(lean);
			model.leftArm.originZ += 2f * MathHelper.sin(lean);
			model.head.originZ -= 1.5f * lean;
			model.head.pitch -= lean * 0.6f;
			float pump = stride * amp * 0.5f * p.sprint() * kk;
			model.rightArm.pitch += pump;
			model.leftArm.pitch -= pump;
			if (p.anime() > 0.01f && !busy) {
				float a = p.anime();
				model.rightArm.pitch = MathHelper.lerp(a, model.rightArm.pitch, 1.35f);
				model.leftArm.pitch = MathHelper.lerp(a, model.leftArm.pitch, 1.35f);
				model.rightArm.roll = MathHelper.lerp(a, model.rightArm.roll, 0.25f);
				model.leftArm.roll = MathHelper.lerp(a, model.leftArm.roll, -0.25f);
			}
		}

		// --- Jumping: knees tucked, arms out for balance.
		if (p.rise() > 0.01f) {
			float r = p.rise() * kk;
			model.rightLeg.pitch -= 0.6f * r;
			model.leftLeg.pitch += 0.25f * r;
			model.rightArm.roll += 0.5f * r;
			model.leftArm.roll -= 0.5f * r;
		}
		// --- Falling: arms fly up and flail; in wild styles a spread-eagle skydive.
		if (p.fall() > 0.05f) {
			float f = Math.min(1f, p.fall()) * kk;
			float flail = MathHelper.sin(age * 0.9f) * 0.35f * f;
			if (wild && p.fall() > 0.5f) {
				float d = (p.fall() - 0.5f) * 2f;
				model.rightArm.pitch = MathHelper.lerp(d, model.rightArm.pitch, -0.2f + flail);
				model.leftArm.pitch = MathHelper.lerp(d, model.leftArm.pitch, -0.2f - flail);
				model.rightArm.roll = MathHelper.lerp(d, model.rightArm.roll, 1.4f);
				model.leftArm.roll = MathHelper.lerp(d, model.leftArm.roll, -1.4f);
				model.rightLeg.roll = MathHelper.lerp(d, model.rightLeg.roll, 0.35f);
				model.leftLeg.roll = MathHelper.lerp(d, model.leftLeg.roll, -0.35f);
				model.head.pitch -= 0.3f * d;
			} else {
				model.rightArm.pitch += (-1.9f * f) + flail;
				model.leftArm.pitch += (-1.9f * f) - flail;
				model.rightArm.roll += 0.5f * f;
				model.leftArm.roll -= 0.5f * f;
			}
			model.rightLeg.pitch += MathHelper.sin(age * 0.7f) * 0.3f * f;
			model.leftLeg.pitch -= MathHelper.sin(age * 0.7f) * 0.3f * f;
		}
		// --- Landing: squash that springs back; hard landings become a superhero landing.
		if (Math.abs(p.land()) > 0.01f) {
			float l = p.land() * kk;
			root.originY += l * 2.2f;
			model.body.pitch += l * 0.16f;
			model.rightArm.roll += l * 0.25f;
			model.leftArm.roll -= l * 0.25f;
			if (wild && p.land() > 0.6f) {
				float h = Math.min(1f, (p.land() - 0.6f) * 1.5f);
				root.originY += h * 4f;
				model.body.pitch += 0.45f * h;
				model.head.pitch -= 0.5f * h;
				model.rightArm.pitch = MathHelper.lerp(h, model.rightArm.pitch, 0.4f);
				model.rightArm.roll = MathHelper.lerp(h, model.rightArm.roll, 0.15f);
				model.leftArm.pitch = MathHelper.lerp(h, model.leftArm.pitch, -0.3f);
				model.leftArm.roll = MathHelper.lerp(h, model.leftArm.roll, -1.0f);
				model.rightLeg.pitch = MathHelper.lerp(h, model.rightLeg.pitch, -1.2f);
				model.leftLeg.pitch = MathHelper.lerp(h, model.leftLeg.pitch, 0.6f);
			}
		}

		// --- Ladder / vine climbing: hands reach up alternately.
		if (p.climb() > 0.01f) {
			float cl = p.climb();
			float step = MathHelper.sin(age * 0.45f);
			model.rightArm.pitch = MathHelper.lerp(cl, model.rightArm.pitch, -2.6f + step * 0.5f);
			model.leftArm.pitch = MathHelper.lerp(cl, model.leftArm.pitch, -2.6f - step * 0.5f);
			model.rightArm.roll = MathHelper.lerp(cl, model.rightArm.roll, 0.1f);
			model.leftArm.roll = MathHelper.lerp(cl, model.leftArm.roll, -0.1f);
			model.rightLeg.pitch = MathHelper.lerp(cl, model.rightLeg.pitch, -0.5f - step * 0.45f);
			model.leftLeg.pitch = MathHelper.lerp(cl, model.leftLeg.pitch, -0.5f + step * 0.45f);
			model.head.pitch -= 0.3f * cl;
		}

		// --- Eating / drinking: hand to mouth with a chewing bob.
		if (p.eating()) {
			Arm arm = state.activeHand == Hand.MAIN_HAND ? state.mainArm : state.mainArm.getOpposite();
			ModelPart part = arm == Arm.RIGHT ? model.rightArm : model.leftArm;
			int side = arm == Arm.RIGHT ? 1 : -1;
			float chew = MathHelper.sin(age * 1.6f);
			part.pitch = -1.45f + chew * 0.15f;
			part.yaw = -0.5f * side;
			part.roll = 0;
			model.head.pitch += 0.14f + Math.abs(chew) * 0.08f;
		}

		// --- Hurt flinch.
		if (p.hurt() > 0.01f) {
			float h = p.hurt() * kk;
			model.body.pitch -= 0.18f * h;
			model.head.pitch -= 0.35f * h;
			model.rightArm.roll += 0.35f * h;
			model.leftArm.roll -= 0.35f * h;
		}

		// --- Tool swings and combos (third hit of a weapon: full body spin).
		if (sp > 0 && !p.eating()) {
			Arm arm = state.preferredArm;
			ModelPart part = arm == Arm.RIGHT ? model.rightArm : model.leftArm;
			int side = arm == Arm.RIGHT ? 1 : -1;
			ItemStack stack = state.getItemStackForArm(arm);
			float s = MathHelper.sin(sp * (float) Math.PI) * kk;
			float snap = MathHelper.sin(MathHelper.sqrt(sp) * (float) Math.PI) * kk;
			int dir = p.combo() == 1 ? -1 : 1;
			if (stack.isEmpty()) {
				// Fist combo: jab, hook, uppercut.
				switch (p.combo()) {
					case 1 -> {
						part.pitch = MathHelper.lerp(snap / kk, part.pitch, -1.45f);
						part.yaw += side * -1.1f * snap;
						model.body.yaw += side * -0.45f * s;
					}
					case 2 -> {
						float up = MathHelper.sin(sp * (float) Math.PI);
						part.pitch = MathHelper.lerp(up, part.pitch, -2.7f);
						part.roll += side * 0.2f * up;
						model.body.pitch -= 0.25f * s;
						model.head.pitch -= 0.3f * s;
						root.originY -= 1.5f * s;
					}
					default -> {
						part.pitch = MathHelper.lerp(snap / kk, part.pitch, -1.6f);
						part.yaw += side * -0.15f * snap;
						model.body.yaw += side * -0.3f * s;
						part.originZ -= 2f * s;
					}
				}
			} else if (stack.isIn(ItemTags.SWORDS) || stack.isOf(Items.TRIDENT) || stack.isOf(Items.MACE)) {
				part.yaw += side * dir * -1.0f * snap;
				part.roll += side * dir * 0.6f * s;
				model.body.yaw += side * dir * -0.35f * s;
				if (p.combo() == 2) {
					root.yaw += side * (float) Math.PI * 2 * smooth(sp);
					part.pitch -= 1.2f * s;
				}
			} else if (stack.isIn(ItemTags.AXES) || stack.isIn(ItemTags.PICKAXES)) {
				part.pitch -= 1.3f * MathHelper.sin((1 - sp) * (float) Math.PI) * (sp < 0.35f ? 1 : 0.4f) * kk;
				model.body.pitch += 0.2f * s;
				if (p.combo() == 2 && stack.isIn(ItemTags.AXES)) {
					model.leftArm.pitch = model.rightArm.pitch;
				}
			} else if (stack.isIn(ItemTags.SHOVELS) || stack.isIn(ItemTags.HOES)) {
				part.pitch -= 0.6f * s;
				model.body.pitch += 0.25f * s;
			} else if (stack.getItem() instanceof BlockItem) {
				part.pitch -= 0.5f * s;
				part.yaw += side * -0.25f * s;
			} else {
				model.body.yaw += side * -0.2f * s * dir;
				if (p.combo() == 2) {
					part.pitch -= 1.0f * s;
				}
			}
		}

		// --- Idle fidgets: look around, stretch, tap the foot.
		if (wild && p.idle() > 4f && !busy) {
			float cycle = (p.idle() - 4f) % 9f;
			int kind = (int) ((p.idle() - 4f) / 9f) % 3;
			float bell = cycle < 3f ? MathHelper.sin(cycle / 3f * (float) Math.PI) : 0;
			if (bell > 0) {
				switch (kind) {
					case 0 -> model.head.yaw += MathHelper.sin(cycle * 2.1f) * 0.9f * bell;
					case 1 -> {
						model.rightArm.pitch = MathHelper.lerp(bell, model.rightArm.pitch, -2.9f);
						model.leftArm.pitch = MathHelper.lerp(bell, model.leftArm.pitch, -2.9f);
						model.rightArm.roll = MathHelper.lerp(bell, model.rightArm.roll, -0.3f);
						model.leftArm.roll = MathHelper.lerp(bell, model.leftArm.roll, 0.3f);
						model.head.pitch -= 0.35f * bell;
					}
					default -> {
						model.rightLeg.pitch += MathHelper.sin(cycle * 9f) * 0.25f * bell;
						model.rightArm.roll += 0.2f * bell;
						model.body.roll += 0.06f * bell;
					}
				}
			}
		}

		// --- Sprint-jump front flip around the body centre.
		if (p.flip() >= 0) {
			float f = p.flip();
			float tuck = MathHelper.sin(f * (float) Math.PI);
			pivotRootAtBodyCentre(model);
			root.pitch += (float) Math.PI * 2 * smooth(f);
			model.rightLeg.pitch -= 1.3f * tuck;
			model.leftLeg.pitch -= 1.3f * tuck;
			model.rightArm.pitch -= 1.1f * tuck;
			model.leftArm.pitch -= 1.1f * tuck;
		}
	}

	private static void holdPose(BipedEntityModel<?> model, BipedEntityRenderState state, Arm arm, float k) {
		ItemStack stack = state.getItemStackForArm(arm);
		ModelPart part = arm == Arm.RIGHT ? model.rightArm : model.leftArm;
		ModelPart other = arm == Arm.RIGHT ? model.leftArm : model.rightArm;
		int side = arm == Arm.RIGHT ? 1 : -1;
		float kk = Math.min(k, 1.3f);
		switch (hold(stack)) {
			case HANG -> part.pitch = MathHelper.lerp(0.7f, part.pitch, -0.25f);
			case LIGHT -> {
				// Hold the light up and forward to see.
				part.pitch = MathHelper.lerp(0.8f, part.pitch, -1.15f) * 1f;
				part.yaw += side * -0.15f * kk;
			}
			case TOTEM -> {
				part.pitch = MathHelper.lerp(0.7f, part.pitch, -1.6f);
				part.roll += side * -0.2f;
			}
			case BLOCK -> {
				// Carry the block in front with both hands.
				if (state.getItemStackForArm(arm.getOpposite()).isEmpty() && arm == state.mainArm) {
					part.pitch = MathHelper.lerp(0.85f, part.pitch, -0.95f);
					other.pitch = MathHelper.lerp(0.85f, other.pitch, -0.95f);
					part.yaw = side * -0.35f;
					other.yaw = side * 0.35f;
				}
			}
			case FOOD -> part.pitch = MathHelper.lerp(0.6f, part.pitch, -0.75f);
			case ROD -> part.pitch = MathHelper.lerp(0.7f, part.pitch, -0.85f);
			case BOW -> {
				part.pitch = MathHelper.lerp(0.6f, part.pitch, -0.35f);
				part.roll += side * 0.25f * kk;
			}
			case SHIELD -> {
				part.pitch = MathHelper.lerp(0.6f, part.pitch, -0.55f);
				part.yaw += side * 0.35f;
			}
			case WEAPON -> part.pitch -= 0.22f * kk;
			default -> {
			}
		}
	}

	/** Moves the root's pivot from the neck to the middle of the body so rotations spin around the belly. */
	private static void pivotRootAtBodyCentre(BipedEntityModel<?> model) {
		ModelPart root = model.getRootPart();
		root.originY += 12f;
		for (ModelPart part : new ModelPart[] {model.head, model.body, model.rightArm, model.leftArm, model.rightLeg, model.leftLeg}) {
			part.originY -= 12f;
		}
	}

	private static float smooth(float t) {
		t = MathHelper.clamp(t, 0, 1);
		return t * t * (3 - 2 * t);
	}

	/** Re-attaches the arms to the shoulders after the torso was rotated. */
	private static void placeArmsOnBody(BipedEntityModel<?> model) {
		float yaw = model.body.yaw;
		model.rightArm.originZ = MathHelper.sin(yaw) * 5.0f;
		model.rightArm.originX = -MathHelper.cos(yaw) * 5.0f;
		model.leftArm.originZ = -MathHelper.sin(yaw) * 5.0f;
		model.leftArm.originX = MathHelper.cos(yaw) * 5.0f;
	}
}
