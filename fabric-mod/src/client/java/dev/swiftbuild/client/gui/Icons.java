package dev.swiftbuild.client.gui;

import dev.swiftbuild.build.BuildMode;
import net.minecraft.client.gui.DrawContext;

/** Tiny 8×8 pixel-art icons for the build modes, drawn with plain rectangles. */
public final class Icons {
	private Icons() {
	}

	private static String[] pattern(BuildMode mode) {
		return switch (mode) {
			case VANILLA -> new String[] {
				"..####..", ".#....#.", "#....#.#", "#...#..#", "#..#...#", "#.#....#", ".#....#.", "..####.."};
			case SINGLE -> new String[] {
				"........", "........", "..####..", "..#++#..", "..#++#..", "..####..", "........", "........"};
			case LINE -> new String[] {
				"........", "........", "........", "########", "#+#+#+##", "........", "........", "........"};
			case WALL -> new String[] {
				"########", "#+++#++#", "########", "#++#+++#", "########", "#+++#++#", "########", "........"};
			case FLOOR -> new String[] {
				"........", "........", "....####", "...#+++#", "..#+++#.", ".#+++#..", "####....", "........"};
			case CUBE -> new String[] {
				"..######", ".#++++##", "######+#", "#++++#+#", "#++++#+#", "#++++##.", "######..", "........"};
			case CIRCLE -> new String[] {
				"..####..", ".#....#.", "#......#", "#......#", "#......#", "#......#", ".#....#.", "..####.."};
			case CYLINDER -> new String[] {
				".######.", "#++++++#", ".######.", "#......#", "#......#", "#......#", ".######.", "........"};
			case SPHERE -> new String[] {
				"..####..", ".#++++#.", "#+##+++#", "#+#++++#", "#++++++#", "#++++++#", ".#++++#.", "..####.."};
			case PYRAMID -> new String[] {
				"........", "...##...", "..#++#..", "..#++#..", ".#++++#.", ".#++++#.", "########", "........"};
		};
	}

	/** Draws the icon centered on (cx, cy); one icon pixel is {@code px} GUI pixels. */
	public static void draw(DrawContext ctx, BuildMode mode, int cx, int cy, int px, int main, int shade) {
		String[] rows = pattern(mode);
		int x0 = cx - 4 * px;
		int y0 = cy - 4 * px;
		for (int r = 0; r < 8; r++) {
			String row = rows[r];
			for (int c = 0; c < 8; c++) {
				char ch = row.charAt(c);
				if (ch == '.') {
					continue;
				}
				int color = ch == '#' ? main : shade;
				ctx.fill(x0 + c * px, y0 + r * px, x0 + (c + 1) * px, y0 + (r + 1) * px, color);
			}
		}
	}
}
