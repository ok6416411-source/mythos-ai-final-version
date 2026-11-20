package dev.swiftbuild.client.gui;

import net.minecraft.client.gui.DrawContext;

/** Filled circles and rings built from horizontal spans (DrawContext only draws rectangles). */
public final class Shapes2D {
	private Shapes2D() {
	}

	public static void disk(DrawContext ctx, int cx, int cy, int r, int color) {
		for (int dy = -r; dy <= r; dy++) {
			int half = (int) Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
			ctx.fill(cx - half, cy + dy, cx + half, cy + dy + 1, color);
		}
	}

	public static void ring(DrawContext ctx, int cx, int cy, int outer, int inner, int color) {
		for (int dy = -outer; dy <= outer; dy++) {
			int ho = (int) Math.round(Math.sqrt(Math.max(0, outer * outer - dy * dy)));
			if (Math.abs(dy) >= inner) {
				ctx.fill(cx - ho, cy + dy, cx + ho, cy + dy + 1, color);
			} else {
				int hi = (int) Math.round(Math.sqrt(inner * inner - dy * dy));
				ctx.fill(cx - ho, cy + dy, cx - hi, cy + dy + 1, color);
				ctx.fill(cx + hi, cy + dy, cx + ho, cy + dy + 1, color);
			}
		}
	}

	public static int alpha(int argb, float a) {
		int base = (argb >>> 24) & 0xFF;
		int na = Math.max(0, Math.min(255, (int) (base * a)));
		return (na << 24) | (argb & 0xFFFFFF);
	}
}
