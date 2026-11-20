package dev.swiftbuild.client.gui;

import dev.swiftbuild.build.BuildMode;
import dev.swiftbuild.client.BuildController;
import dev.swiftbuild.client.ClientConfig;
import dev.swiftbuild.client.Easing;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.client.util.InputUtil;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import org.lwjgl.glfw.GLFW;

/**
 * Hold-to-open radial menu. Mode bubbles fly out one after another with a springy ease,
 * the hovered one grows and lights up, and releasing the key picks it.
 */
public class RadialMenuScreen extends Screen {
	private static final BuildMode[] MODES = BuildMode.values();
	private static final int ACCENT = 0xFF3FE0D0;
	private static final int RADIUS = 84;

	/** Keeps the menu open without the key held (used by the development screenshot script). */
	public static boolean holdOverride;

	private final KeyBinding key;
	private final long opened = Util.getMeasuringTimeMs();
	private final float[] hover = new float[MODES.length];
	private final List<SideButton> buttons = new ArrayList<>();
	private int hovered = -1;
	private int lastHovered = -1;

	private record SideButton(int x, int y, int w, int h, Supplier<Text> label, Runnable action, float[] hover) {
		boolean contains(double mx, double my) {
			return mx >= x && mx < x + w && my >= y && my < y + h;
		}
	}

	public RadialMenuScreen(KeyBinding key) {
		super(Text.literal("SwiftBuild"));
		this.key = key;
	}

	@Override
	protected void init() {
		buttons.clear();
		int cx = width / 2;
		int cy = height / 2;
		int bx = Math.min(width - 128, cx + RADIUS + 44);
		int by = cy - 58;
		ClientConfig c = ClientConfig.get();
		addSide(bx, by, () -> Text.translatable("swiftbuild.menu.fill", Text.translatable(c.fill.translationKey())), () -> {
			c.fill = c.fill.next();
			BuildController.onModeChanged();
		});
		addSide(bx, by + 24, () -> Text.translatable("swiftbuild.menu.mix", onOff(c.mix)), () -> {
			c.mix = !c.mix;
			BuildController.onModeChanged();
		});
		addSide(bx, by + 48, () -> Text.translatable("swiftbuild.menu.modifiers"), () -> client.setScreen(new ModifierScreen(null)));
		addSide(bx, by + 72, () -> Text.translatable("swiftbuild.menu.undo"), () -> BuildController.undo(false));
		addSide(bx, by + 96, () -> Text.translatable("swiftbuild.menu.redo"), () -> BuildController.undo(true));
	}

	static Text onOff(boolean on) {
		return Text.translatable(on ? "swiftbuild.on" : "swiftbuild.off");
	}

	private void addSide(int x, int y, Supplier<Text> label, Runnable action) {
		buttons.add(new SideButton(x, y, 120, 20, label, action, new float[1]));
	}

	@Override
	public boolean shouldPause() {
		return false;
	}

	@Override
	public void renderBackground(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
		float open = Easing.outCubic((Util.getMeasuringTimeMs() - opened) / 200f);
		context.fillGradient(0, 0, width, height, Shapes2D.alpha(0x70000000, open), Shapes2D.alpha(0xA0000000, open));
	}

	private boolean keyHeld() {
		if (holdOverride) {
			return true;
		}
		InputUtil.Key bound = KeyBindingHelper.getBoundKeyOf(key);
		long handle = client.getWindow().getHandle();
		if (bound.getCategory() == InputUtil.Type.MOUSE) {
			return GLFW.glfwGetMouseButton(handle, bound.getCode()) == GLFW.GLFW_PRESS;
		}
		return bound.getCode() >= 0 && InputUtil.isKeyPressed(client.getWindow(), bound.getCode());
	}

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
		if (!keyHeld()) {
			choose(hovered);
			return;
		}
		long now = Util.getMeasuringTimeMs();
		int cx = width / 2;
		int cy = height / 2;
		float ringT = Easing.outBack((now - opened) / 260f);
		int ring = Math.max(1, (int) (RADIUS * ringT));

		// Hover detection by angle, so the mouse only has to point in a direction.
		double dx = mouseX - cx;
		double dy = mouseY - cy;
		boolean overButton = buttons.stream().anyMatch(b -> b.contains(mouseX, mouseY));
		hovered = -1;
		if (!overButton && dx * dx + dy * dy > 26 * 26) {
			double angle = Math.atan2(dy, dx) + Math.PI / 2;
			double slice = Math.PI * 2 / MODES.length;
			hovered = Math.floorMod((int) Math.round(angle / slice), MODES.length);
		}
		if (hovered != lastHovered && hovered >= 0) {
			client.getSoundManager().play(PositionedSoundInstance.ui(SoundEvents.BLOCK_NOTE_BLOCK_HAT.value(), 1.4f + hovered * 0.05f, 0.25f));
		}
		lastHovered = hovered;

		Shapes2D.ring(ctx, cx, cy, ring + 27, Math.max(0, ring - 27), Shapes2D.alpha(0x8A0E1620, Easing.clamp(ringT)));
		Shapes2D.ring(ctx, cx, cy, ring + 28, ring + 27, Shapes2D.alpha(0x553FE0D0, Easing.clamp(ringT)));

		BuildMode current = ClientConfig.get().mode;
		for (int i = 0; i < MODES.length; i++) {
			float t = Easing.clamp((now - opened - i * 22) / 240f);
			if (t <= 0) {
				continue;
			}
			float e = Easing.outBack(t);
			hover[i] = Easing.lerp(hover[i], i == hovered ? 1f : 0f, Math.min(1f, delta * 0.5f + 0.2f));
			double angle = -Math.PI / 2 + i * Math.PI * 2 / MODES.length;
			int x = cx + (int) Math.round(Math.cos(angle) * RADIUS * e);
			int y = cy + (int) Math.round(Math.sin(angle) * RADIUS * e);
			int size = Math.max(2, (int) ((15 + 5 * hover[i]) * Math.min(1.2f, e)));
			boolean selected = MODES[i] == current;
			int border = selected ? ACCENT : Shapes2D.alpha(0xFFB8C4CC, 0.35f + 0.65f * hover[i]);
			Shapes2D.disk(ctx, x, y, size + 2, Shapes2D.alpha(border, t));
			int fill = blend(0xF0202A33, 0xF0237C77, hover[i]);
			Shapes2D.disk(ctx, x, y, size, Shapes2D.alpha(fill, t));
			if (t > 0.5f) {
				int px = hover[i] > 0.5f ? 3 : 2;
				Icons.draw(ctx, MODES[i], x, y, px, Shapes2D.alpha(0xFFFFFFFF, t), Shapes2D.alpha(selected ? 0xFF3FE0D0 : 0xFF8FA3B0, t));
			}
		}

		// Center bubble with the hovered (or current) mode.
		BuildMode shown = hovered >= 0 ? MODES[hovered] : current;
		Shapes2D.disk(ctx, cx, cy, 25, 0xE0101820);
		Shapes2D.ring(ctx, cx, cy, 26, 25, Shapes2D.alpha(ACCENT, 0.7f));
		ctx.drawCenteredTextWithShadow(textRenderer, Text.translatable(shown.translationKey()), cx, cy - 4, 0xFFFFFFFF);
		ctx.drawCenteredTextWithShadow(textRenderer, Text.translatable(shown.translationKey() + ".desc"), cx, cy + RADIUS + 38, 0xFFBFD9DD);
		ctx.drawCenteredTextWithShadow(textRenderer, Text.translatable("swiftbuild.menu.hint"), cx, height - 28, 0xFF8FA3B0);

		for (int i = 0; i < buttons.size(); i++) {
			SideButton b = buttons.get(i);
			float t = Easing.clamp((now - opened - 120 - i * 35) / 220f);
			if (t <= 0) {
				continue;
			}
			int slide = (int) ((1 - Easing.outCubic(t)) * 30);
			boolean over = b.contains(mouseX, mouseY);
			b.hover()[0] = Easing.lerp(b.hover()[0], over ? 1f : 0f, 0.3f);
			int x = b.x() + slide;
			ctx.fill(x, b.y(), x + b.w(), b.y() + b.h(), Shapes2D.alpha(blend(0xD0101820, 0xE0237C77, b.hover()[0]), t));
			ctx.fill(x, b.y(), x + 2, b.y() + b.h(), Shapes2D.alpha(ACCENT, t));
			ctx.drawTextWithShadow(textRenderer, b.label().get(), x + 8, b.y() + 6, Shapes2D.alpha(0xFFFFFFFF, t));
		}
		super.render(ctx, mouseX, mouseY, delta);
	}

	@Override
	public boolean mouseClicked(Click click, boolean doubled) {
		for (SideButton b : buttons) {
			if (b.contains(click.x(), click.y())) {
				client.getSoundManager().play(PositionedSoundInstance.ui(SoundEvents.UI_BUTTON_CLICK, 1.0f));
				b.action().run();
				return true;
			}
		}
		if (hovered >= 0) {
			choose(hovered);
			return true;
		}
		return super.mouseClicked(click, doubled);
	}

	private void choose(int index) {
		if (index >= 0 && index < MODES.length && ClientConfig.get().mode != MODES[index]) {
			ClientConfig.get().mode = MODES[index];
			BuildController.onModeChanged();
			BuildHud.flash();
			client.getSoundManager().play(PositionedSoundInstance.ui(SoundEvents.BLOCK_AMETHYST_BLOCK_CHIME, 1.2f, 0.8f));
		}
		if (client.currentScreen == this) {
			close();
		}
	}

	private static int blend(int a, int b, float t) {
		int aa = (int) Easing.lerp((a >>> 24) & 0xFF, (b >>> 24) & 0xFF, t);
		int r = (int) Easing.lerp((a >> 16) & 0xFF, (b >> 16) & 0xFF, t);
		int g = (int) Easing.lerp((a >> 8) & 0xFF, (b >> 8) & 0xFF, t);
		int bl = (int) Easing.lerp(a & 0xFF, b & 0xFF, t);
		return aa << 24 | r << 16 | g << 8 | bl;
	}
}
