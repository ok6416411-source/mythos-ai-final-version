package dev.swiftbuild.build;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;

/**
 * Turns the points a player clicked into block positions. Runs on both sides: the client
 * uses it for the hologram preview, the server recomputes it from the request so it never
 * has to trust a list of positions sent by a client.
 */
public final class ShapeGenerator {
	/** Shapes whose bounding box is larger than this are refused before iterating. */
	public static final long MAX_SCAN_VOLUME = 4_000_000L;

	private ShapeGenerator() {
	}

	/**
	 * @param points the clicked points; if fewer than the mode needs, the last one is repeated
	 *               (used for live preview while the player is still picking)
	 */
	public static ShapeResult generate(BuildMode mode, FillMode fill, List<BlockPos> points, Modifiers modifiers, int limit) {
		if (mode == BuildMode.VANILLA || points.isEmpty()) {
			return new ShapeResult(List.of(), false);
		}
		BlockPos[] p = new BlockPos[Math.max(1, mode.clicks)];
		for (int i = 0; i < p.length; i++) {
			p[i] = points.get(Math.min(i, points.size() - 1));
		}
		Collector out = new Collector(limit);
		switch (mode) {
			case SINGLE -> out.add(p[0]);
			case LINE -> line(p[0], p[1], out);
			case WALL -> wall(p[0], p[1], fill, out);
			case FLOOR -> floor(p[0], p[1], fill, out);
			case CUBE -> cube(p[0], new BlockPos(p[1].getX(), p[2].getY(), p[1].getZ()), fill, out);
			case CIRCLE -> cylinder(p[0], p[1], p[0].getY(), fill == FillMode.FILLED ? FillMode.FILLED : FillMode.OUTLINE, out);
			case CYLINDER -> cylinder(p[0], p[1], p[2].getY(), fill, out);
			case SPHERE -> sphere(p[0], p[1], fill, out);
			case PYRAMID -> pyramid(p[0], p[1], fill, out);
			default -> {
			}
		}
		List<BlockPos> base = new ArrayList<>(out.set);
		ShapeResult modified = applyModifiers(base, modifiers, limit);
		return new ShapeResult(modified.positions(), out.truncated || modified.truncated());
	}

	public static ShapeResult applyModifiers(List<BlockPos> base, Modifiers m, int limit) {
		if (m == null || !m.any()) {
			return new ShapeResult(base, false);
		}
		Collector out = new Collector(limit);
		List<BlockPos> current = base;
		if (m.array() && m.arrayCount() > 1) {
			for (int i = 0; i < m.arrayCount(); i++) {
				for (BlockPos pos : current) {
					out.add(pos.add(m.arrayX() * i, m.arrayY() * i, m.arrayZ() * i));
				}
			}
			current = new ArrayList<>(out.set);
		}
		if (m.mirror()) {
			if (m.mirrorX()) {
				current = mirror(current, out, pos -> new BlockPos(m.mirrorX2() - pos.getX() - 1, pos.getY(), pos.getZ()));
			}
			if (m.mirrorY()) {
				current = mirror(current, out, pos -> new BlockPos(pos.getX(), m.mirrorY2() - pos.getY() - 1, pos.getZ()));
			}
			if (m.mirrorZ()) {
				current = mirror(current, out, pos -> new BlockPos(pos.getX(), pos.getY(), m.mirrorZ2() - pos.getZ() - 1));
			}
		}
		if (m.radial() && m.radialSlices() > 1) {
			double cx = m.radialX2() / 2.0;
			double cz = m.radialZ2() / 2.0;
			for (BlockPos pos : current) {
				out.add(pos);
			}
			for (int s = 1; s < m.radialSlices(); s++) {
				double angle = Math.PI * 2 * s / m.radialSlices();
				double cos = Math.cos(angle);
				double sin = Math.sin(angle);
				for (BlockPos pos : current) {
					double dx = pos.getX() + 0.5 - cx;
					double dz = pos.getZ() + 0.5 - cz;
					double rx = dx * cos - dz * sin + cx;
					double rz = dx * sin + dz * cos + cz;
					out.add(new BlockPos(MathHelper.floor(rx), pos.getY(), MathHelper.floor(rz)));
				}
			}
			current = new ArrayList<>(out.set);
		}
		for (BlockPos pos : current) {
			out.add(pos);
		}
		return new ShapeResult(new ArrayList<>(out.set), out.truncated);
	}

	/** Sorts positions by distance from the origin so animations ripple outward. */
	public static void sortFrom(List<BlockPos> positions, BlockPos origin) {
		positions.sort(Comparator.comparingDouble(pos -> pos.getSquaredDistance(origin)));
	}

	private static List<BlockPos> mirror(List<BlockPos> current, Collector out, java.util.function.UnaryOperator<BlockPos> f) {
		for (BlockPos pos : current) {
			out.add(pos);
			out.add(f.apply(pos));
		}
		return new ArrayList<>(out.set);
	}

	private static void line(BlockPos a, BlockPos b, Collector out) {
		int dx = b.getX() - a.getX();
		int dy = b.getY() - a.getY();
		int dz = b.getZ() - a.getZ();
		int n = Math.max(Math.abs(dx), Math.max(Math.abs(dy), Math.abs(dz)));
		if (n == 0) {
			out.add(a);
			return;
		}
		for (int i = 0; i <= n && !out.full(); i++) {
			double t = (double) i / n;
			out.add(new BlockPos(a.getX() + (int) Math.round(dx * t), a.getY() + (int) Math.round(dy * t), a.getZ() + (int) Math.round(dz * t)));
		}
	}

	private static void wall(BlockPos a, BlockPos b, FillMode fill, Collector out) {
		int dx = b.getX() - a.getX();
		int dz = b.getZ() - a.getZ();
		int n = Math.max(Math.abs(dx), Math.abs(dz));
		int minY = Math.min(a.getY(), b.getY());
		int maxY = Math.max(a.getY(), b.getY());
		if ((long) (n + 1) * (maxY - minY + 1) > MAX_SCAN_VOLUME) {
			out.truncated = true;
			return;
		}
		for (int y = minY; y <= maxY && !out.full(); y++) {
			for (int i = 0; i <= n; i++) {
				boolean edge = i == 0 || i == n || y == minY || y == maxY;
				if (fill != FillMode.FILLED && !edge) {
					continue;
				}
				double t = n == 0 ? 0 : (double) i / n;
				out.add(new BlockPos(a.getX() + (int) Math.round(dx * t), y, a.getZ() + (int) Math.round(dz * t)));
			}
		}
	}

	private static void floor(BlockPos a, BlockPos b, FillMode fill, Collector out) {
		int minX = Math.min(a.getX(), b.getX());
		int maxX = Math.max(a.getX(), b.getX());
		int minZ = Math.min(a.getZ(), b.getZ());
		int maxZ = Math.max(a.getZ(), b.getZ());
		if ((long) (maxX - minX + 1) * (maxZ - minZ + 1) > MAX_SCAN_VOLUME) {
			out.truncated = true;
			return;
		}
		for (int x = minX; x <= maxX && !out.full(); x++) {
			for (int z = minZ; z <= maxZ; z++) {
				boolean edge = x == minX || x == maxX || z == minZ || z == maxZ;
				if (fill == FillMode.FILLED || edge) {
					out.add(new BlockPos(x, a.getY(), z));
				}
			}
		}
	}

	private static void cube(BlockPos a, BlockPos b, FillMode fill, Collector out) {
		int minX = Math.min(a.getX(), b.getX());
		int maxX = Math.max(a.getX(), b.getX());
		int minY = Math.min(a.getY(), b.getY());
		int maxY = Math.max(a.getY(), b.getY());
		int minZ = Math.min(a.getZ(), b.getZ());
		int maxZ = Math.max(a.getZ(), b.getZ());
		if ((long) (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1) > MAX_SCAN_VOLUME) {
			out.truncated = true;
			return;
		}
		for (int y = minY; y <= maxY && !out.full(); y++) {
			for (int x = minX; x <= maxX; x++) {
				for (int z = minZ; z <= maxZ; z++) {
					int borders = (x == minX || x == maxX ? 1 : 0) + (y == minY || y == maxY ? 1 : 0) + (z == minZ || z == maxZ ? 1 : 0);
					boolean keep = switch (fill) {
						case FILLED -> true;
						case HOLLOW -> borders >= 1;
						case OUTLINE -> borders >= 2;
					};
					if (keep) {
						out.add(new BlockPos(x, y, z));
					}
				}
			}
		}
	}

	private static boolean inEllipse(int x, int z, double rx, double rz) {
		double fx = x / (rx + 0.5);
		double fz = z / (rz + 0.5);
		return fx * fx + fz * fz <= 1.0;
	}

	private static void cylinder(BlockPos center, BlockPos radiusPoint, int topY, FillMode fill, Collector out) {
		int rx = Math.abs(radiusPoint.getX() - center.getX());
		int rz = Math.abs(radiusPoint.getZ() - center.getZ());
		if (rx == 0 && rz == 0) {
			rx = rz = Math.max(rx, rz);
		}
		// A circle feels more natural than a flat ellipse when the player drags diagonally.
		if (Math.abs(rx - rz) <= 1) {
			rx = rz = Math.max(rx, rz);
		}
		int minY = Math.min(center.getY(), topY);
		int maxY = Math.max(center.getY(), topY);
		if ((long) (2 * rx + 1) * (2 * rz + 1) * (maxY - minY + 1) > MAX_SCAN_VOLUME) {
			out.truncated = true;
			return;
		}
		for (int y = minY; y <= maxY && !out.full(); y++) {
			boolean cap = y == minY || y == maxY;
			for (int x = -rx; x <= rx; x++) {
				for (int z = -rz; z <= rz; z++) {
					if (!inEllipse(x, z, rx, rz)) {
						continue;
					}
					boolean ring = !inEllipse(x + 1, z, rx, rz) || !inEllipse(x - 1, z, rx, rz)
						|| !inEllipse(x, z + 1, rx, rz) || !inEllipse(x, z - 1, rx, rz);
					boolean keep = switch (fill) {
						case FILLED -> true;
						case HOLLOW -> ring || cap;
						case OUTLINE -> ring;
					};
					if (keep) {
						out.add(new BlockPos(center.getX() + x, y, center.getZ() + z));
					}
				}
			}
		}
	}

	private static void sphere(BlockPos center, BlockPos radiusPoint, FillMode fill, Collector out) {
		int r = (int) Math.round(Math.sqrt(center.getSquaredDistance(radiusPoint)));
		if ((long) (2 * r + 1) * (2 * r + 1) * (2 * r + 1) > MAX_SCAN_VOLUME) {
			out.truncated = true;
			return;
		}
		double limit = (r + 0.5) * (r + 0.5);
		for (int y = -r; y <= r && !out.full(); y++) {
			// OUTLINE builds a dome: only the upper half of the shell.
			if (fill == FillMode.OUTLINE && y < 0) {
				continue;
			}
			for (int x = -r; x <= r; x++) {
				for (int z = -r; z <= r; z++) {
					if (x * x + y * y + z * z > limit) {
						continue;
					}
					if (fill != FillMode.FILLED) {
						boolean shell = sq(x + 1, y, z) > limit || sq(x - 1, y, z) > limit || sq(x, y + 1, z) > limit
							|| sq(x, y - 1, z) > limit || sq(x, y, z + 1) > limit || sq(x, y, z - 1) > limit;
						if (!shell) {
							continue;
						}
					}
					out.add(center.add(x, y, z));
				}
			}
		}
	}

	private static double sq(int x, int y, int z) {
		return x * x + y * y + z * z;
	}

	private static void pyramid(BlockPos a, BlockPos b, FillMode fill, Collector out) {
		int minX = Math.min(a.getX(), b.getX());
		int maxX = Math.max(a.getX(), b.getX());
		int minZ = Math.min(a.getZ(), b.getZ());
		int maxZ = Math.max(a.getZ(), b.getZ());
		if ((long) (maxX - minX + 1) * (maxZ - minZ + 1) * Math.min(maxX - minX + 1, maxZ - minZ + 1) > MAX_SCAN_VOLUME) {
			out.truncated = true;
			return;
		}
		for (int k = 0; minX + k <= maxX - k && minZ + k <= maxZ - k && !out.full(); k++) {
			int x0 = minX + k;
			int x1 = maxX - k;
			int z0 = minZ + k;
			int z1 = maxZ - k;
			int y = a.getY() + k;
			for (int x = x0; x <= x1; x++) {
				for (int z = z0; z <= z1; z++) {
					boolean ex = x == x0 || x == x1;
					boolean ez = z == z0 || z == z1;
					boolean keep = switch (fill) {
						case FILLED -> true;
						case HOLLOW -> ex || ez || k == 0;
						case OUTLINE -> (ex && ez) || (k == 0 && (ex || ez)) || (x0 == x1 || z0 == z1);
					};
					if (keep) {
						out.add(new BlockPos(x, y, z));
					}
				}
			}
		}
	}

	private static final class Collector {
		final Set<BlockPos> set = new LinkedHashSet<>();
		final int limit;
		boolean truncated;

		Collector(int limit) {
			this.limit = limit;
		}

		void add(BlockPos pos) {
			if (set.size() >= limit) {
				if (!set.contains(pos)) {
					truncated = true;
				}
				return;
			}
			set.add(pos.toImmutable());
		}

		boolean full() {
			return set.size() >= limit;
		}
	}
}
