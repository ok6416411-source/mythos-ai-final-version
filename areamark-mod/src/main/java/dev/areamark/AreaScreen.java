package dev.areamark;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.gui.widget.ClickableWidget;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;

/** Key H: list of marked areas. Rows slide in one after another. */
public class AreaScreen extends Screen {
	private static final int ROW = 24;
	private final long opened = Util.getMeasuringTimeMs();
	private final List<List<ClickableWidget>> rows = new ArrayList<>();
	private final List<int[]> rowBaseX = new ArrayList<>();
	private int scroll;
	private Area selected;
	private TextFieldWidget nameField;
	private String info = "";

	public AreaScreen() {
		super(Text.translatable("areamark.screen.title"));
	}

	private List<Area> areas() {
		List<Area> list = new ArrayList<>();
		String dim = AreaStore.currentDim();
		for (Area a : AreaStore.all()) {
			if (a.removingAt < 0 && a.dim.equals(dim)) {
				list.add(a);
			}
		}
		return list;
	}

	private int visibleRows() {
		return Math.max(1, (height - 110) / ROW);
	}

	@Override
	protected void init() {
		rows.clear();
		rowBaseX.clear();
		List<Area> list = areas();
		scroll = Math.max(0, Math.min(scroll, list.size() - visibleRows()));
		int left = width / 2 - 200;
		int y = 36;
		for (int i = scroll; i < Math.min(list.size(), scroll + visibleRows()); i++) {
			Area a = list.get(i);
			List<ClickableWidget> row = new ArrayList<>();
			row.add(button(left, y, 20, Text.literal("◆").withColor(a.color & 0xFFFFFF), b -> {
				int idx = 0;
				for (int c = 0; c < AreaStore.COLORS.length; c++) {
					if (AreaStore.COLORS[c] == a.color) {
						idx = c;
					}
				}
				a.color = AreaStore.COLORS[(idx + 1) % AreaStore.COLORS.length];
				AreaStore.save();
				clearAndInit();
			}));
			row.add(button(left + 22, y, 168, Text.literal((a == selected ? "» " : "") + a.name + "  §7" + a.sizeText()), b -> {
				selected = a;
				nameField.setText(a.name);
				clearAndInit();
			}));
			row.add(button(left + 192, y, 36, Text.translatable(a.visible ? "areamark.screen.shown" : "areamark.screen.hidden"), b -> {
				a.visible = !a.visible;
				AreaStore.save();
				clearAndInit();
			}));
			row.add(button(left + 230, y, 50, Text.translatable("areamark.screen.copy"), b -> {
				client.keyboard.setClipboard(a.minX + " " + a.minY + " " + a.minZ + " " + a.maxX + " " + a.maxY + " " + a.maxZ);
				info = Text.translatable("areamark.screen.copied").getString();
			}));
			row.add(button(left + 282, y, 34, Text.literal("WE"), b -> {
				if (client.player != null) {
					client.player.networkHandler.sendChatCommand("/pos1 " + a.minX + "," + a.minY + "," + a.minZ);
					client.player.networkHandler.sendChatCommand("/pos2 " + a.maxX + "," + a.maxY + "," + a.maxZ);
					info = Text.translatable("areamark.screen.we_sent").getString();
				}
			}));
			row.add(button(left + 318, y, 56, Text.translatable("areamark.screen.count"), b -> info = count(a)));
			row.add(button(left + 376, y, 24, Text.literal("✕").withColor(0xFF6060), b -> {
				AreaStore.remove(a);
				if (a == selected) {
					selected = null;
				}
				clearAndInit();
			}));
			int[] base = new int[row.size()];
			for (int k = 0; k < row.size(); k++) {
				base[k] = row.get(k).getX();
			}
			rows.add(row);
			rowBaseX.add(base);
			y += ROW;
		}

		int by = height - 56;
		nameField = new TextFieldWidget(textRenderer, left, by, 196, 20, Text.translatable("areamark.screen.name"));
		nameField.setMaxLength(48);
		if (selected != null) {
			nameField.setText(selected.name);
		}
		addDrawableChild(nameField);
		button(left + 200, by, 96, Text.translatable("areamark.screen.rename"), b -> {
			if (selected != null && !nameField.getText().isBlank()) {
				selected.name = nameField.getText().trim();
				AreaStore.save();
				clearAndInit();
			}
		});
		button(left + 300, by, 100, Text.translatable(AreaConfig.get().showAreas ? "areamark.screen.all_on" : "areamark.screen.all_off"), b -> {
			AreaConfig.get().showAreas = !AreaConfig.get().showAreas;
			AreaConfig.save();
			clearAndInit();
		});
		button(width / 2 - 100, height - 30, 200, Text.translatable("gui.done"), b -> close());
	}

	private ButtonWidget button(int x, int y, int w, Text text, ButtonWidget.PressAction action) {
		return addDrawableChild(ButtonWidget.builder(text, action).dimensions(x, y, w, 20).build());
	}

	/** Counts the blocks inside the area (loaded chunks only). */
	private String count(Area a) {
		if (client.world == null) {
			return "";
		}
		if (a.volume() > 2_000_000) {
			return Text.translatable("areamark.screen.too_big").getString();
		}
		Map<Block, Integer> counts = new HashMap<>();
		BlockPos.Mutable p = new BlockPos.Mutable();
		long air = 0;
		for (int x = a.minX; x <= a.maxX; x++) {
			for (int y = a.minY; y <= a.maxY; y++) {
				for (int z = a.minZ; z <= a.maxZ; z++) {
					p.set(x, y, z);
					BlockState s = client.world.getBlockState(p);
					if (s.isAir()) {
						air++;
					} else {
						counts.merge(s.getBlock(), 1, Integer::sum);
					}
				}
			}
		}
		StringBuilder sb = new StringBuilder();
		counts.entrySet().stream().sorted((x, y) -> y.getValue() - x.getValue()).limit(5).forEach(e -> {
			if (!sb.isEmpty()) {
				sb.append("  ·  ");
			}
			sb.append(e.getKey().getName().getString()).append(" ").append(e.getValue());
		});
		if (sb.isEmpty()) {
			sb.append(Text.translatable("areamark.screen.empty").getString());
		}
		return a.name + ": " + sb + "  ·  " + Text.translatable("areamark.screen.air", air).getString();
	}

	@Override
	public boolean mouseScrolled(double mouseX, double mouseY, double h, double v) {
		int before = scroll;
		scroll = Math.max(0, scroll - (int) Math.signum(v));
		if (scroll != before) {
			clearAndInit();
		}
		return true;
	}

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
		long now = Util.getMeasuringTimeMs();
		for (int i = 0; i < rows.size(); i++) {
			float t = Ease.outCubic((now - opened - i * 45L) / 260f);
			int offset = (int) ((1 - t) * 60);
			List<ClickableWidget> row = rows.get(i);
			int[] base = rowBaseX.get(i);
			for (int k = 0; k < row.size(); k++) {
				row.get(k).setX(base[k] + offset);
				row.get(k).setAlpha(t);
			}
		}
		super.render(ctx, mouseX, mouseY, delta);
		float t = Ease.outCubic((now - opened) / 300f);
		ctx.drawCenteredTextWithShadow(textRenderer, title, width / 2, 12 - (int) ((1 - t) * 8), Ease.withAlpha(0xFFC060, t));
		ctx.drawCenteredTextWithShadow(textRenderer, Text.translatable("areamark.screen.hint"), width / 2, 23, Ease.withAlpha(0x9A9AA8, t));
		if (rows.isEmpty()) {
			ctx.drawCenteredTextWithShadow(textRenderer, Text.translatable("areamark.screen.none"), width / 2, 60, 0xFFBBBBBB);
		}
		if (!info.isEmpty()) {
			ctx.drawCenteredTextWithShadow(textRenderer, Text.literal(info), width / 2, height - 72, 0xFFFFE0A0);
		}
	}

	@Override
	public boolean shouldPause() {
		return false;
	}
}
