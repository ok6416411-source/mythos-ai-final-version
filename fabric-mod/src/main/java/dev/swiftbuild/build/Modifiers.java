package dev.swiftbuild.build;

import net.minecraft.network.PacketByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.util.math.MathHelper;

/**
 * Shape modifiers that copy the base shape: array (repeat with an offset), mirror
 * (on up to three axes) and radial (rotate around a vertical axis).
 * Centers are stored in half-block units ("doubled" coordinates) so a mirror can sit
 * either in the middle of a block or on the seam between two blocks.
 */
public record Modifiers(
	boolean array, int arrayCount, int arrayX, int arrayY, int arrayZ,
	boolean mirror, boolean mirrorX, boolean mirrorY, boolean mirrorZ, int mirrorX2, int mirrorY2, int mirrorZ2,
	boolean radial, int radialSlices, int radialX2, int radialZ2
) {
	public static final int MAX_ARRAY = 64;
	public static final int MAX_SLICES = 16;
	public static final Modifiers NONE = new Modifiers(false, 2, 1, 0, 0, false, true, false, false, 0, 0, 0, false, 4, 0, 0);

	public static final PacketCodec<PacketByteBuf, Modifiers> CODEC = PacketCodec.of(
		(m, buf) -> {
			buf.writeBoolean(m.array);
			buf.writeVarInt(m.arrayCount);
			buf.writeVarInt(m.arrayX);
			buf.writeVarInt(m.arrayY);
			buf.writeVarInt(m.arrayZ);
			buf.writeBoolean(m.mirror);
			buf.writeBoolean(m.mirrorX);
			buf.writeBoolean(m.mirrorY);
			buf.writeBoolean(m.mirrorZ);
			buf.writeVarInt(m.mirrorX2);
			buf.writeVarInt(m.mirrorY2);
			buf.writeVarInt(m.mirrorZ2);
			buf.writeBoolean(m.radial);
			buf.writeVarInt(m.radialSlices);
			buf.writeVarInt(m.radialX2);
			buf.writeVarInt(m.radialZ2);
		},
		buf -> new Modifiers(
			buf.readBoolean(), buf.readVarInt(), buf.readVarInt(), buf.readVarInt(), buf.readVarInt(),
			buf.readBoolean(), buf.readBoolean(), buf.readBoolean(), buf.readBoolean(), buf.readVarInt(), buf.readVarInt(), buf.readVarInt(),
			buf.readBoolean(), buf.readVarInt(), buf.readVarInt(), buf.readVarInt()
		).sanitized()
	);

	public boolean any() {
		return (array && arrayCount > 1) || (mirror && (mirrorX || mirrorY || mirrorZ)) || (radial && radialSlices > 1);
	}

	/** Clamps every value to a safe range; used on everything received from the network. */
	public Modifiers sanitized() {
		return new Modifiers(
			array, MathHelper.clamp(arrayCount, 1, MAX_ARRAY),
			MathHelper.clamp(arrayX, -64, 64), MathHelper.clamp(arrayY, -64, 64), MathHelper.clamp(arrayZ, -64, 64),
			mirror, mirrorX, mirrorY, mirrorZ, mirrorX2, mirrorY2, mirrorZ2,
			radial, MathHelper.clamp(radialSlices, 1, MAX_SLICES), radialX2, radialZ2
		);
	}

	public Modifiers withArray(boolean on, int count, int x, int y, int z) {
		return new Modifiers(on, count, x, y, z, mirror, mirrorX, mirrorY, mirrorZ, mirrorX2, mirrorY2, mirrorZ2, radial, radialSlices, radialX2, radialZ2).sanitized();
	}

	public Modifiers withMirror(boolean on, boolean x, boolean y, boolean z, int x2, int y2, int z2) {
		return new Modifiers(array, arrayCount, arrayX, arrayY, arrayZ, on, x, y, z, x2, y2, z2, radial, radialSlices, radialX2, radialZ2).sanitized();
	}

	public Modifiers withRadial(boolean on, int slices, int x2, int z2) {
		return new Modifiers(array, arrayCount, arrayX, arrayY, arrayZ, mirror, mirrorX, mirrorY, mirrorZ, mirrorX2, mirrorY2, mirrorZ2, on, slices, x2, z2).sanitized();
	}
}
