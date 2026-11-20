package dev.areamark;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;

/** Slides in from the top while marking mode is on and explains the three controls. */
public final class MarkHud {
	private static float shown;
	private static long lastNanos = -1;

	private MarkHud() {
	}

	public static void render(DrawContext ctx, RenderTickCounter counter) {
		MinecraftClient mc = MinecraftClient.getInstance();
		long now = System.nanoTime();
		float dt = lastNanos < 0 ? 0.016f : Math.min(0.1f, (now - lastNanos) / 1.0e9f);
		lastNanos = now;
		shown += ((Marker.active() ? 1 : 0) - shown) * Math.min(1f, dt * 10f);
		if (shown < 0.01f || mc.options.hudHidden || mc.player == null) {
			return;
		}
		float e = Ease.outCubic(shown);
		int w = ctx.getScaledWindowWidth();
		Text title = Text.translatable("areamark.hud.title");
		Text line;
		BlockPos p1 = Marker.pos1();
		if (p1 == null) {
			line = Text.translatable("areamark.hud.step1");
		} else if (Marker.pos2() == null) {
			line = Text.translatable("areamark.hud.step2");
		} else {
			BlockPos p2 = Marker.pos2();
			int sx = Math.abs(p1.getX() - p2.getX()) + 1, sy = Math.abs(p1.getY() - p2.getY()) + 1, sz = Math.abs(p1.getZ() - p2.getZ()) + 1;
			line = Text.translatable("areamark.hud.ready", sx + "×" + sy + "×" + sz, (long) sx * sy * sz);
		}
		int width = Math.max(mc.textRenderer.getWidth(title), mc.textRenderer.getWidth(line)) + 20;
		int x = w / 2 - width / 2;
		int y = (int) (-34 + 40 * e);
		ctx.fill(x, y, x + width, y + 28, Ease.alpha(0xC0101418, e));
		float glow = 0.5f + 0.5f * (float) Math.sin(Util.getMeasuringTimeMs() / 300.0);
		ctx.fill(x, y + 26, x + width, y + 28, Ease.withAlpha(0xFFAA28, (0.5f + 0.5f * glow) * e));
		ctx.drawCenteredTextWithShadow(mc.textRenderer, title, w / 2, y + 4, Ease.withAlpha(0xFFC060, e));
		ctx.drawCenteredTextWithShadow(mc.textRenderer, line, w / 2, y + 15, Ease.withAlpha(0xFFFFFF, e));
	}
}
