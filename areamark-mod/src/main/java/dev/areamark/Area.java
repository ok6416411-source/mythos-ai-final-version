package dev.areamark;

import java.util.UUID;
import net.minecraft.util.math.BlockPos;

/** A marked block area (inclusive corners). Plain fields for Gson; transient ones animate. */
public final class Area {
	public String id = UUID.randomUUID().toString();
	public String name = "";
	public int minX, minY, minZ, maxX, maxY, maxZ;
	public int color = 0xFFFFAA28;
	public String dim = "minecraft:overworld";
	public boolean visible = true;

	public transient long appearAt;
	public transient long removingAt = -1;
	/** Corner the grow-in animation starts from. */
	public transient BlockPos origin;

	public Area() {
	}

	public Area(String name, BlockPos a, BlockPos b, int color, String dim) {
		this.name = name;
		this.minX = Math.min(a.getX(), b.getX());
		this.minY = Math.min(a.getY(), b.getY());
		this.minZ = Math.min(a.getZ(), b.getZ());
		this.maxX = Math.max(a.getX(), b.getX());
		this.maxY = Math.max(a.getY(), b.getY());
		this.maxZ = Math.max(a.getZ(), b.getZ());
		this.color = color;
		this.dim = dim;
		this.origin = a;
	}

	public int sizeX() {
		return maxX - minX + 1;
	}

	public int sizeY() {
		return maxY - minY + 1;
	}

	public int sizeZ() {
		return maxZ - minZ + 1;
	}

	public long volume() {
		return (long) sizeX() * sizeY() * sizeZ();
	}

	public BlockPos min() {
		return new BlockPos(minX, minY, minZ);
	}

	public BlockPos max() {
		return new BlockPos(maxX, maxY, maxZ);
	}

	public String sizeText() {
		return volume() == 1 ? "1 Block" : sizeX() + "×" + sizeY() + "×" + sizeZ() + " = " + volume();
	}
}
