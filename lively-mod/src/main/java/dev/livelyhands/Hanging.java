package dev.livelyhands;

import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.util.math.RotationAxis;

/**
 * Items that hang from the hand (3D buckets and lanterns of the built-in pack) and swing like a
 * pendulum. The pivot numbers mirror the display transforms in tools/gen_3d_models.py: the
 * grip point of each model, expressed in the space the item is drawn in.
 */
public final class Hanging {
	public enum Kind {
		NONE(0, 0, 0, 0, 0, 0, 0),
		// first person: translation y (px), scale, grip y (px)    third person: translation z (px), scale, grip y (px)
		BUCKET(6, 0.6f, 8, 0, 0.55f, 8, 1),
		LANTERN(4, 0.7f, 15, -4.9f, 0.7f, 15, 1);

		final float fpTy;
		final float fpScale;
		final float fpGrip;
		final float tpTz;
		final float tpScale;
		final float tpGrip;
		final float weight;

		Kind(float fpTy, float fpScale, float fpGrip, float tpTz, float tpScale, float tpGrip, float weight) {
			this.fpTy = fpTy;
			this.fpScale = fpScale;
			this.fpGrip = fpGrip;
			this.tpTz = tpTz;
			this.tpScale = tpScale;
			this.tpGrip = tpGrip;
			this.weight = weight;
		}
	}

	private Hanging() {
	}

	public static Kind kind(ItemStack s) {
		if (s.isOf(Items.BUCKET) || s.isOf(Items.WATER_BUCKET) || s.isOf(Items.LAVA_BUCKET) || s.isOf(Items.MILK_BUCKET)
			|| s.isOf(Items.POWDER_SNOW_BUCKET) || s.isOf(Items.AXOLOTL_BUCKET) || s.isOf(Items.COD_BUCKET) || s.isOf(Items.SALMON_BUCKET)
			|| s.isOf(Items.PUFFERFISH_BUCKET) || s.isOf(Items.TROPICAL_FISH_BUCKET) || s.isOf(Items.TADPOLE_BUCKET)) {
			return Kind.BUCKET;
		}
		if (s.isOf(Items.LANTERN) || s.isOf(Items.SOUL_LANTERN)) {
			return Kind.LANTERN;
		}
		return Kind.NONE;
	}

	/** First person: hand space, x right, y up. Swings forward/back (X) and sideways (Z). */
	public static void swingFirstPerson(MatrixStack m, Kind kind, float forward, float sideways) {
		float py = kind.fpTy / 16f + kind.fpScale * (kind.fpGrip - 8) / 16f;
		m.translate(0, py, 0);
		m.multiply(RotationAxis.POSITIVE_X.rotationDegrees(forward));
		m.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(sideways));
		m.translate(0, -py, 0);
	}

	/** Third person: item holder space, z points up the arm, y forward. */
	public static void swingThirdPerson(MatrixStack m, Kind kind, float forward, float sideways) {
		float pz = kind.tpTz / 16f + kind.tpScale * (kind.tpGrip - 8) / 16f;
		m.translate(0, 0, pz);
		m.multiply(RotationAxis.POSITIVE_X.rotationDegrees(forward));
		m.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(sideways));
		m.translate(0, 0, -pz);
	}
}
