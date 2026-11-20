package dev.livelyhands;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import net.fabricmc.fabric.api.client.rendering.v1.RenderStateDataKey;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.render.entity.model.PlayerEntityModel;
import net.minecraft.client.render.entity.state.PlayerEntityRenderState;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.BlockItem;
import net.minecraft.item.ItemStack;
import net.minecraft.item.consume.UseAction;
import net.minecraft.registry.tag.ItemTags;
import net.minecraft.util.Arm;
import net.minecraft.util.Util;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

/**
 * Full-body animations for every player model (yourself in F5 and everybody else):
 * torso twist towards the head, sprint lean, walking bounce, breathing, jump tuck,
 * falling flail, landing squash, ladder climbing, eating, hurt flinch and tool-specific swings.
 * Purely client-side; works on any server.
 */
public final class ThirdPerson {
	/** Snapshot of the per-entity motion values, attached to the render state. */
	public record Pose(float sprint, float rise, float fall, float land, float climb, float hurt, float speed, boolean eating) {
	}

	public static final RenderStateDataKey<Pose> POSE = RenderStateDataKey.create(() -> "livelyhands:pose");

	private static final class Track {
		final Spring sprint = new Spring();
		final Spring air = new Spring();
		final Spring land = new Spring();
		final Spring climb = new Spring();
		final Spring hurt = new Spring();
		boolean wasOnGround = true;
		double lastY = Double.NaN;
		double lastVy;
		long lastNanos = -1;
		long seen;
	}

	private static final Map<Integer, Track> TRACKS = new HashMap<>();
	private static long lastCleanup;

	private ThirdPerson() {
	}

	/** Called while the render state is being filled, where the entity itself is still available. */
	public static void update(LivingEntity entity, PlayerEntityRenderState state) {
		LivelyConfig c = LivelyConfig.get();
		if (!c.enabled || !c.thirdPerson) {
			state.setData(POSE, null);
			return;
		}
		long now = System.nanoTime();
		Track t = TRACKS.computeIfAbsent(entity.getId(), id -> new Track());
		float dt = t.lastNanos < 0 ? 0.016f : Math.min(0.05f, (now - t.lastNanos) / 1.0e9f);
		t.lastNanos = now;
		t.seen = Util.getMeasuringTimeMs();

		// Other players' velocity is not synced reliably, so derive vertical speed from position.
		double y = entity.getY();
		double vy = Double.isNaN(t.lastY) || dt <= 0 ? 0 : (y - t.lastY) / (dt * 20.0);
		t.lastY = y;
		boolean onGround = entity.isOnGround();
		if (onGround && !t.wasOnGround && t.lastVy < -0.3) {
			t.land.vel += (float) Math.min(4.0, -t.lastVy * 5.0);
		}
		t.wasOnGround = onGround;
		t.lastVy = vy;

		Vec3d v = entity.getVelocity();
		float horizontal = (float) Math.sqrt(v.x * v.x + v.z * v.z);
		t.sprint.update(entity.isSprinting() ? 1 : 0, 60, 12, dt);
		float airTarget = onGround || entity.isClimbing() || entity.isTouchingWater() ? 0 : (float) MathHelper.clamp(vy * 2.5, -1, 1);
		t.air.update(airTarget, 70, 11, dt);
		t.land.update(0, 120, 9, dt);
		t.climb.update(entity.isClimbing() && !onGround ? 1 : 0, 60, 12, dt);
		t.hurt.update(entity.hurtTime > 0 ? 1 : 0, 200, 16, dt);

		boolean eating = false;
		if (entity.isUsingItem()) {
			UseAction action = entity.getActiveItem().getUseAction();
			eating = action == UseAction.EAT || action == UseAction.DRINK;
		}
		state.setData(POSE, new Pose(t.sprint.pos, Math.max(0, t.air.pos), Math.max(0, -t.air.pos), t.land.pos, t.climb.pos, t.hurt.pos, horizontal, eating));

		if (t.seen - lastCleanup > 10_000) {
			lastCleanup = t.seen;
			long cutoff = t.seen - 10_000;
			for (Iterator<Track> it = TRACKS.values().iterator(); it.hasNext(); ) {
				if (it.next().seen < cutoff) {
					it.remove();
				}
			}
		}
	}

	/** Called after vanilla has posed the model. All values are radians / model pixels. */
	public static void apply(PlayerEntityModel model, PlayerEntityRenderState state) {
		Pose p = state.getData(POSE);
		if (p == null || state.isSwimming || state.isGliding || state.hasVehicle || state.sleepingDirection != null) {
			return;
		}
		float k = LivelyConfig.get().thirdPersonIntensity;
		float age = state.age;
		float limb = state.limbSwingAnimationProgress;
		float amp = Math.min(1f, state.limbSwingAmplitude);

		// --- Breathing and walking bounce.
		float breathe = MathHelper.sin(age * 0.08f);
		model.body.pitch += breathe * 0.015f * k;
		model.rightArm.roll += (0.03f + breathe * 0.02f) * k;
		model.leftArm.roll -= (0.03f + breathe * 0.02f) * k;
		ModelPart root = model.getRootPart();
		root.originY += Math.abs(MathHelper.cos(limb * 0.6662f)) * amp * -0.9f * k;
		model.head.pitch += MathHelper.sin(limb * 1.3324f) * amp * 0.04f * k;

		// --- Torso follows the head a little, like turning the shoulders.
		float twist = MathHelper.clamp(state.relativeHeadYaw * MathHelper.RADIANS_PER_DEGREE * 0.22f, -0.35f, 0.35f) * k;
		if (state.handSwingProgress <= 0) {
			model.body.yaw += twist;
			model.head.yaw -= twist * 0.5f;
			placeArmsOnBody(model);
			model.rightArm.yaw += twist;
			model.leftArm.yaw += twist;
		}

		// --- Sprint lean: torso forward, legs moved back under the hips, arms pump harder.
		float lean = p.sprint() * 0.28f * k;
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
			float pump = MathHelper.cos(limb * 0.6662f) * amp * 0.5f * p.sprint() * k;
			model.rightArm.pitch += pump;
			model.leftArm.pitch -= pump;
		}

		// --- Jumping: knees tucked, arms out for balance.
		if (p.rise() > 0.01f) {
			float r = p.rise() * k;
			model.rightLeg.pitch -= 0.45f * r;
			model.leftLeg.pitch += 0.2f * r;
			model.rightArm.roll += 0.35f * r;
			model.leftArm.roll -= 0.35f * r;
		}
		// --- Falling: arms fly up and flail, legs dangle.
		if (p.fall() > 0.05f) {
			float f = p.fall() * k;
			float flail = MathHelper.sin(age * 0.9f) * 0.35f * f;
			model.rightArm.pitch += (-1.9f * f) + flail;
			model.leftArm.pitch += (-1.9f * f) - flail;
			model.rightArm.roll += 0.5f * f;
			model.leftArm.roll -= 0.5f * f;
			model.rightLeg.pitch += MathHelper.sin(age * 0.7f) * 0.3f * f;
			model.leftLeg.pitch -= MathHelper.sin(age * 0.7f) * 0.3f * f;
		}
		// --- Landing: quick squash downwards that springs back.
		if (Math.abs(p.land()) > 0.01f) {
			float l = p.land() * k;
			root.originY += l * 1.6f;
			model.body.pitch += l * 0.12f;
			model.rightArm.roll += l * 0.2f;
			model.leftArm.roll -= l * 0.2f;
		}

		// --- Ladder / vine climbing: hands reach up alternately.
		if (p.climb() > 0.01f) {
			float c = p.climb() * k;
			float step = MathHelper.sin(age * 0.45f);
			model.rightArm.pitch = MathHelper.lerp(c, model.rightArm.pitch, -2.6f + step * 0.45f);
			model.leftArm.pitch = MathHelper.lerp(c, model.leftArm.pitch, -2.6f - step * 0.45f);
			model.rightArm.roll = MathHelper.lerp(c, model.rightArm.roll, 0.1f);
			model.leftArm.roll = MathHelper.lerp(c, model.leftArm.roll, -0.1f);
			model.rightLeg.pitch = MathHelper.lerp(c, model.rightLeg.pitch, -0.5f - step * 0.4f);
			model.leftLeg.pitch = MathHelper.lerp(c, model.leftLeg.pitch, -0.5f + step * 0.4f);
			model.head.pitch -= 0.25f * c;
		}

		// --- Eating / drinking: hand to mouth with a chewing bob.
		if (p.eating()) {
			Arm arm = state.activeHand == net.minecraft.util.Hand.MAIN_HAND ? state.mainArm : state.mainArm.getOpposite();
			ModelPart part = arm == Arm.RIGHT ? model.rightArm : model.leftArm;
			int side = arm == Arm.RIGHT ? 1 : -1;
			float chew = MathHelper.sin(age * 1.6f);
			part.pitch = -1.35f + chew * 0.12f;
			part.yaw = -0.45f * side;
			part.roll = 0;
			model.head.pitch += 0.12f + Math.abs(chew) * 0.06f;
		}

		// --- Hurt flinch.
		if (p.hurt() > 0.01f) {
			float h = p.hurt() * k;
			model.body.pitch -= 0.12f * h;
			model.head.pitch -= 0.25f * h;
			model.rightArm.roll += 0.25f * h;
			model.leftArm.roll -= 0.25f * h;
		}

		// --- Tool-specific swings on top of vanilla's.
		float sp = state.handSwingProgress;
		if (sp > 0 && !p.eating()) {
			Arm arm = state.preferredArm;
			ModelPart part = arm == Arm.RIGHT ? model.rightArm : model.leftArm;
			int side = arm == Arm.RIGHT ? 1 : -1;
			ItemStack stack = state.getItemStackForArm(arm);
			float s = MathHelper.sin(sp * (float) Math.PI) * k;
			float snap = MathHelper.sin(MathHelper.sqrt(sp) * (float) Math.PI) * k;
			if (stack.isIn(ItemTags.SWORDS)) {
				part.yaw += side * -0.9f * snap;
				part.roll += side * 0.5f * s;
				model.body.yaw += side * -0.25f * s;
			} else if (stack.isIn(ItemTags.AXES) || stack.isIn(ItemTags.PICKAXES)) {
				part.pitch -= 1.1f * MathHelper.sin((1 - sp) * (float) Math.PI) * (sp < 0.35f ? 1 : 0.4f) * k;
				model.body.pitch += 0.15f * s;
			} else if (stack.isIn(ItemTags.SHOVELS) || stack.isIn(ItemTags.HOES)) {
				part.pitch -= 0.5f * s;
				model.body.pitch += 0.2f * s;
			} else if (stack.getItem() instanceof BlockItem) {
				part.pitch -= 0.4f * s;
				part.yaw += side * -0.2f * s;
			}
		} else if (!state.isUsingItem && !p.eating()) {
			// Ready stance: a weapon in hand is held slightly raised.
			Arm arm = state.mainArm;
			ItemStack stack = state.getItemStackForArm(arm);
			if (stack.isIn(ItemTags.SWORDS) || stack.isIn(ItemTags.AXES)) {
				ModelPart part = arm == Arm.RIGHT ? model.rightArm : model.leftArm;
				part.pitch -= 0.18f * k;
			}
		}
	}

	/** Re-attaches the arms to the shoulders after the torso was rotated. */
	private static void placeArmsOnBody(PlayerEntityModel model) {
		float yaw = model.body.yaw;
		model.rightArm.originZ = MathHelper.sin(yaw) * 5.0f;
		model.rightArm.originX = -MathHelper.cos(yaw) * 5.0f;
		model.leftArm.originZ = -MathHelper.sin(yaw) * 5.0f;
		model.leftArm.originX = MathHelper.cos(yaw) * 5.0f;
	}
}
