package dev.swiftbuild.build;

/**
 * All shapes SwiftBuild can build. {@link #clicks} is the number of points the
 * player has to pick before the shape is final.
 */
public enum BuildMode {
	VANILLA(0),
	SINGLE(1),
	LINE(2),
	WALL(2),
	FLOOR(2),
	CUBE(3),
	CIRCLE(2),
	CYLINDER(3),
	SPHERE(2),
	PYRAMID(2);

	public final int clicks;

	BuildMode(int clicks) {
		this.clicks = clicks;
	}

	public String translationKey() {
		return "swiftbuild.mode." + name().toLowerCase(java.util.Locale.ROOT);
	}

	public static BuildMode byId(int id) {
		BuildMode[] values = values();
		return id >= 0 && id < values.length ? values[id] : VANILLA;
	}
}
