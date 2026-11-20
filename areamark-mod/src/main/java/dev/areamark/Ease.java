package dev.areamark;

public final class Ease {
	private Ease() {
	}

	public static float clamp(float t) {
		return t < 0 ? 0 : (t > 1 ? 1 : t);
	}

	public static float outCubic(float t) {
		float u = 1 - clamp(t);
		return 1 - u * u * u;
	}

	public static float outBack(float t) {
		double u = clamp(t) - 1;
		return (float) (1 + 2.70158 * u * u * u + 1.70158 * u * u);
	}

	public static float inCubic(float t) {
		t = clamp(t);
		return t * t * t;
	}

	public static int alpha(int argb, float a) {
		int base = (argb >>> 24) & 0xFF;
		return ((int) (base * clamp(a)) << 24) | (argb & 0xFFFFFF);
	}

	public static int withAlpha(int rgb, float a) {
		return ((int) (255 * clamp(a)) << 24) | (rgb & 0xFFFFFF);
	}
}
