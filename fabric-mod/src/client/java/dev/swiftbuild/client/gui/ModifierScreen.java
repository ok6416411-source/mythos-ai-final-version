package dev.swiftbuild.client.gui;

import dev.swiftbuild.build.Modifiers;
import dev.swiftbuild.client.BuildController;
import dev.swiftbuild.client.ClientConfig;
import dev.swiftbuild.client.Easing;
import java.util.function.Consumer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;

/** Settings for array / mirror / radial modifiers, hotbar mix and client visuals. */
public class ModifierScreen extends Screen {
	private final Screen parent;
	private final long opened = Util.getMeasuringTimeMs();
	private boolean edge;

	public ModifierScreen(Screen parent) {
		super(Text.translatable("swiftbuild.screen.title"));
		this.parent = parent;
		Modifiers m = ClientConfig.get().modifiers;
		this.edge = Math.floorMod(m.mirrorX2(), 2) == 0 && m.mirror();
	}

	private static Text onOff(boolean on) {
		return RadialMenuScreen.onOff(on);
	}

	private Modifiers m() {
		return ClientConfig.get().modifiers;
	}

	private void set(Modifiers value) {
		ClientConfig.get().modifiers = value.sanitized();
		BuildController.onModeChanged();
		clearAndInit();
	}

	@Override
	protected void init() {
		int col = 154;
		int left = width / 2 - col - 4;
		int right = width / 2 + 4;
		int y = 40;
		Modifiers m = m();

		// --- Array
		button(left, y, col, Text.translatable("swiftbuild.screen.array", onOff(m.array())),
			b -> set(m.withArray(!m.array(), Math.max(2, m.arrayCount()), m.arrayX(), m.arrayY(), m.arrayZ())));
		stepper(right, y, Text.translatable("swiftbuild.screen.count", m.arrayCount()),
			d -> set(m.withArray(m.array(), m.arrayCount() + d, m.arrayX(), m.arrayY(), m.arrayZ())));
		y += 24;
		stepper(left, y, Text.translatable("swiftbuild.screen.offset", "X", m.arrayX()),
			d -> set(m.withArray(m.array(), m.arrayCount(), m.arrayX() + d, m.arrayY(), m.arrayZ())));
		stepper(right, y, Text.translatable("swiftbuild.screen.offset", "Y", m.arrayY()),
			d -> set(m.withArray(m.array(), m.arrayCount(), m.arrayX(), m.arrayY() + d, m.arrayZ())));
		y += 24;
		stepper(left, y, Text.translatable("swiftbuild.screen.offset", "Z", m.arrayZ()),
			d -> set(m.withArray(m.array(), m.arrayCount(), m.arrayX(), m.arrayY(), m.arrayZ() + d)));
		y += 32;

		// --- Mirror
		button(left, y, col, Text.translatable("swiftbuild.screen.mirror", onOff(m.mirror())), b -> {
			if (!m.mirror() && m.mirrorX2() == 0 && m.mirrorY2() == 0 && m.mirrorZ2() == 0) {
				int[] c = centerHere();
				set(m.withMirror(true, m.mirrorX(), m.mirrorY(), m.mirrorZ(), c[0], c[1], c[2]));
			} else {
				set(m.withMirror(!m.mirror(), m.mirrorX(), m.mirrorY(), m.mirrorZ(), m.mirrorX2(), m.mirrorY2(), m.mirrorZ2()));
			}
		});
		button(right, y, col, Text.translatable("swiftbuild.screen.center_here"), b -> {
			int[] c = centerHere();
			set(m.withMirror(m.mirror(), m.mirrorX(), m.mirrorY(), m.mirrorZ(), c[0], c[1], c[2]));
		});
		y += 24;
		int third = (col * 2 + 8 - 8) / 3;
		button(left, y, third, Text.translatable("swiftbuild.screen.axis", "X", onOff(m.mirrorX())),
			b -> set(m.withMirror(m.mirror(), !m.mirrorX(), m.mirrorY(), m.mirrorZ(), m.mirrorX2(), m.mirrorY2(), m.mirrorZ2())));
		button(left + third + 4, y, third, Text.translatable("swiftbuild.screen.axis", "Y", onOff(m.mirrorY())),
			b -> set(m.withMirror(m.mirror(), m.mirrorX(), !m.mirrorY(), m.mirrorZ(), m.mirrorX2(), m.mirrorY2(), m.mirrorZ2())));
		button(left + 2 * (third + 4), y, third, Text.translatable("swiftbuild.screen.axis", "Z", onOff(m.mirrorZ())),
			b -> set(m.withMirror(m.mirror(), m.mirrorX(), m.mirrorY(), !m.mirrorZ(), m.mirrorX2(), m.mirrorY2(), m.mirrorZ2())));
		y += 24;
		button(left, y, col * 2 + 8, Text.translatable("swiftbuild.screen.center_edge", onOff(edge)), b -> {
			edge = !edge;
			int[] c = centerHere();
			set(m.withMirror(m.mirror(), m.mirrorX(), m.mirrorY(), m.mirrorZ(), c[0], c[1], c[2]));
		});
		y += 32;

		// --- Radial
		button(left, y, col, Text.translatable("swiftbuild.screen.radial", onOff(m.radial())), b -> {
			if (!m.radial() && m.radialX2() == 0 && m.radialZ2() == 0) {
				int[] c = centerHere();
				set(m.withRadial(true, Math.max(2, m.radialSlices()), c[0], c[2]));
			} else {
				set(m.withRadial(!m.radial(), m.radialSlices(), m.radialX2(), m.radialZ2()));
			}
		});
		stepper(right, y, Text.translatable("swiftbuild.screen.slices", m.radialSlices()),
			d -> set(m.withRadial(m.radial(), Math.max(2, m.radialSlices() + d), m.radialX2(), m.radialZ2())));
		y += 24;
		button(left, y, col * 2 + 8, Text.translatable("swiftbuild.screen.center_here"), b -> {
			int[] c = centerHere();
			set(m.withRadial(m.radial(), m.radialSlices(), c[0], c[2]));
		});
		y += 32;

		// --- Other
		ClientConfig cfg = ClientConfig.get();
		button(left, y, col, Text.translatable("swiftbuild.screen.mix", onOff(cfg.mix)), b -> {
			cfg.mix = !cfg.mix;
			BuildController.onModeChanged();
			clearAndInit();
		});
		button(right, y, col, Text.translatable("swiftbuild.screen.animations", onOff(cfg.animations)), b -> {
			cfg.animations = !cfg.animations;
			ClientConfig.save();
			clearAndInit();
		});
		y += 24;
		button(left, y, col, Text.translatable("swiftbuild.screen.preview", onOff(cfg.preview)), b -> {
			cfg.preview = !cfg.preview;
			ClientConfig.save();
			clearAndInit();
		});
		button(right, y, col, Text.translatable("swiftbuild.screen.hud", onOff(cfg.hud)), b -> {
			cfg.hud = !cfg.hud;
			ClientConfig.save();
			clearAndInit();
		});
		y += 24;
		button(left, y, col, Text.translatable("swiftbuild.screen.client_mode", onOff(cfg.clientMode)), b -> {
			cfg.clientMode = !cfg.clientMode;
			BuildController.onModeChanged();
			clearAndInit();
		});
		stepper(right, y, Text.translatable("swiftbuild.screen.client_speed", cfg.clientBlocksPerTick), d -> {
			cfg.clientBlocksPerTick = Math.max(1, Math.min(8, cfg.clientBlocksPerTick + d));
			ClientConfig.save();
			clearAndInit();
		});
		y += 32;
		button(width / 2 - 100, Math.min(y, height - 28), 200, Text.translatable("gui.done"), b -> close());
	}

	/** Mirror / radial center at the player's feet, in half-block units. */
	private int[] centerHere() {
		BlockPos p = client.player == null ? BlockPos.ORIGIN : client.player.getBlockPos();
		int off = edge ? 0 : 1;
		return new int[] {p.getX() * 2 + off, p.getY() * 2 + off, p.getZ() * 2 + off};
	}

	private void button(int x, int y, int w, Text text, ButtonWidget.PressAction action) {
		addDrawableChild(ButtonWidget.builder(text, action).dimensions(x, y, w, 20).build());
	}

	private void stepper(int x, int y, Text label, Consumer<Integer> change) {
		addDrawableChild(ButtonWidget.builder(Text.literal("-"), b -> change.accept(-1)).dimensions(x, y, 20, 20).build());
		addDrawableChild(ButtonWidget.builder(label, b -> {
		}).dimensions(x + 22, y, 110, 20).build()).active = false;
		addDrawableChild(ButtonWidget.builder(Text.literal("+"), b -> change.accept(1)).dimensions(x + 134, y, 20, 20).build());
	}

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
		super.render(ctx, mouseX, mouseY, delta);
		float t = Easing.outCubic((Util.getMeasuringTimeMs() - opened) / 300f);
		int y = 14 - (int) ((1 - t) * 10);
		ctx.drawCenteredTextWithShadow(textRenderer, title, width / 2, y, Shapes2D.alpha(0xFF3FE0D0, t));
		Modifiers m = m();
		String center = (m.mirrorX2() / 2.0) + " / " + (m.mirrorY2() / 2.0) + " / " + (m.mirrorZ2() / 2.0);
		ctx.drawCenteredTextWithShadow(textRenderer, Text.translatable("swiftbuild.screen.center", center), width / 2, y + 12, Shapes2D.alpha(0xFF8FA3B0, t));
	}

	@Override
	public void close() {
		client.setScreen(parent);
	}

	@Override
	public boolean shouldPause() {
		return false;
	}
}
