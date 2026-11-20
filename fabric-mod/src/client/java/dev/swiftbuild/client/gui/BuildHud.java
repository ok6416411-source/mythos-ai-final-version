package dev.swiftbuild.client.gui;

import dev.swiftbuild.build.BuildAction;
import dev.swiftbuild.build.BuildMode;
import dev.swiftbuild.build.Modifiers;
import dev.swiftbuild.client.BuildController;
import dev.swiftbuild.client.ClientConfig;
import dev.swiftbuild.client.Easing;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;

/** Compact panel in the top-left corner: mode, fill, modifiers and live size of the shape. */
public final class BuildHud {
	private static long flashAt = -10000;

	private BuildHud() {
	}

	/** Slide the panel in again (after a mode change). */
	public static void flash() {
		flashAt = Util.getMeasuringTimeMs();
	}

	public static void render(DrawContext ctx, RenderTickCounter tickCounter) {
		MinecraftClient mc = MinecraftClient.getInstance();
		ClientConfig cfg = ClientConfig.get();
		if (!cfg.hud || mc.player == null || mc.options.hudHidden || mc.getDebugHud().shouldShowDebugHud()) {
			return;
		}
		BuildMode mode = cfg.mode;
		if (mode == BuildMode.VANILLA) {
			return;
		}
		TextRenderer tr = mc.textRenderer;
		long now = Util.getMeasuringTimeMs();
		float slide = Easing.outBack((now - flashAt) / 350f);
		int x = 6 - (int) ((1 - slide) * 140);
		int y = 6;

		List<Text> lines = new ArrayList<>();
		if (!BuildController.serverSupported) {
			lines.add(Text.translatable("swiftbuild.hud.no_server"));
		} else {
			StringBuilder mods = new StringBuilder();
			Modifiers m = cfg.modifiers;
			if (m.array() && m.arrayCount() > 1) mods.append(Text.translatable("swiftbuild.mod.array").getString()).append(" ×").append(m.arrayCount()).append("  ");
			if (m.mirror() && (m.mirrorX() || m.mirrorY() || m.mirrorZ())) {
				mods.append(Text.translatable("swiftbuild.mod.mirror").getString()).append(' ');
				if (m.mirrorX()) mods.append('X');
				if (m.mirrorY()) mods.append('Y');
				if (m.mirrorZ()) mods.append('Z');
				mods.append("  ");
			}
			if (m.radial() && m.radialSlices() > 1) mods.append(Text.translatable("swiftbuild.mod.radial").getString()).append(" ×").append(m.radialSlices()).append("  ");
			if (cfg.mix) mods.append(Text.translatable("swiftbuild.mod.mix").getString());
			if (!mods.isEmpty()) {
				lines.add(Text.literal(mods.toString().trim()));
			}
			BuildController.Preview preview = BuildController.preview(mc, tickCounter.getTickProgress(true));
			BuildAction action = BuildController.action();
			if (action != null) {
				lines.add(Text.translatable(action == BuildAction.PLACE ? "swiftbuild.hud.place" : "swiftbuild.hud.break")
					.append(" · ").append(Text.translatable("swiftbuild.hud.step", BuildController.step() + 1, mode.clicks)));
			}
			if (preview != null && preview.positions().size() > 1) {
				int[] size = size(preview.positions());
				lines.add(Text.translatable("swiftbuild.hud.size", size[0], size[1], size[2]).append(" · ")
					.append(Text.translatable("swiftbuild.hud.blocks", preview.positions().size())));
				if (preview.truncated()) {
					int limit = mc.player.isCreative() ? BuildController.limits.maxBlocksCreative() : BuildController.limits.maxBlocksSurvival();
					lines.add(Text.translatable("swiftbuild.hud.limit", limit));
				}
			}
			if (action != null) {
				lines.add(Text.translatable(action == BuildAction.PLACE ? "swiftbuild.hud.cancel" : "swiftbuild.hud.cancel_break"));
			}
		}

		Text title = Text.translatable(mode.translationKey()).append(" · ").append(Text.translatable(cfg.fill.translationKey()));
		int w = 26 + tr.getWidth(title);
		for (Text line : lines) {
			w = Math.max(w, 8 + tr.getWidth(line));
		}
		int h = 20 + lines.size() * 10;
		ctx.fill(x, y, x + w + 6, y + h, 0xB0101820);
		ctx.fill(x, y, x + 2, y + h, 0xFF3FE0D0);
		float glow = 1 - Easing.clamp((now - flashAt) / 900f);
		if (glow > 0) {
			ctx.fill(x, y, x + w + 6, y + h, Shapes2D.alpha(0x603FE0D0, glow));
		}
		Icons.draw(ctx, mode, x + 12, y + 10, 1, 0xFFFFFFFF, 0xFF3FE0D0);
		ctx.drawTextWithShadow(tr, title, x + 22, y + 6, 0xFFFFFFFF);
		int ly = y + 19;
		for (Text line : lines) {
			ctx.drawTextWithShadow(tr, line, x + 8, ly, 0xFFBFD9DD);
			ly += 10;
		}
	}

	private static int[] size(List<BlockPos> positions) {
		int minX = Integer.MAX_VALUE, minY = Integer.MAX_VALUE, minZ = Integer.MAX_VALUE;
		int maxX = Integer.MIN_VALUE, maxY = Integer.MIN_VALUE, maxZ = Integer.MIN_VALUE;
		for (BlockPos p : positions) {
			minX = Math.min(minX, p.getX());
			minY = Math.min(minY, p.getY());
			minZ = Math.min(minZ, p.getZ());
			maxX = Math.max(maxX, p.getX());
			maxY = Math.max(maxY, p.getY());
			maxZ = Math.max(maxZ, p.getZ());
		}
		return new int[] {maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1};
	}
}
