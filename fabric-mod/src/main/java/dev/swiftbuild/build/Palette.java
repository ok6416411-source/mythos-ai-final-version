package dev.swiftbuild.build;

import net.minecraft.util.math.BlockPos;

/**
 * Deterministic block choice for the hotbar mix modifier. Client preview and server
 * placement use the same seed, so the hologram shows exactly what will be built.
 */
public final class Palette {
	private Palette() {
	}

	public static int pick(long seed, BlockPos pos, int size) {
		if (size <= 1) {
			return 0;
		}
		long h = seed ^ (pos.asLong() * 0x9E3779B97F4A7C15L);
		h ^= h >>> 33;
		h *= 0xff51afd7ed558ccdL;
		h ^= h >>> 33;
		h *= 0xc4ceb9fe1a85ec53L;
		h ^= h >>> 33;
		return (int) Math.floorMod(h, (long) size);
	}
}
