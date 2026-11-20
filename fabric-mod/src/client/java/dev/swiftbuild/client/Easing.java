package dev.swiftbuild.client;

/** Small easing helpers for the animations. All take and return values in [0, 1]. */
public final class Easing {
	private static final double C1 = 1.70158;
	private static final double C3 = C1 + 1;

	private Easing() {
	}

	public static float clamp(float t) {
		return t < 0 ? 0 : (t > 1 ? 1 : t);
	}

	public static float outCubic(float t) {
		float u = 1 - clamp(t);
		return 1 - u * u * u;
	}

	public static float inCubic(float t) {
		t = clamp(t);
		return t * t * t;
	}

	/** Overshoots a little past 1 before settling: the "pop" when a block appears. */
	public static float outBack(float t) {
		double u = clamp(t) - 1;
		return (float) (1 + C3 * u * u * u + C1 * u * u);
	}

	/** Pulls back slightly below 0 before accelerating: the wind-up when a block vanishes. */
	public static float inBack(float t) {
		double u = clamp(t);
		return (float) (C3 * u * u * u - C1 * u * u);
	}

	public static float lerp(float a, float b, float t) {
		return a + (b - a) * t;
	}
}
