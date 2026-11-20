package dev.livelyhands;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Util;

/** In-game settings (key O): every animation group can be switched off or scaled at any time. */
public class LivelyScreen extends Screen {
	private static final float[] STEPS = {0.25f, 0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 2.0f};
	private final Screen parent;
	private final long opened = Util.getMeasuringTimeMs();

	public LivelyScreen(Screen parent) {
		super(Text.translatable("livelyhands.screen.title"));
		this.parent = parent;
	}

	private static Text onOff(boolean on) {
		return Text.translatable(on ? "options.on" : "options.off");
	}

	private static float next(float value) {
		for (float step : STEPS) {
			if (step > value + 0.01f) {
				return step;
			}
		}
		return STEPS[0];
	}

	private interface Toggle {
		void flip(LivelyConfig c);
	}

	private void toggle(int x, int y, int w, String key, boolean value, Toggle t) {
		addDrawableChild(ButtonWidget.builder(Text.translatable(key, onOff(value)), b -> {
			t.flip(LivelyConfig.get());
			LivelyConfig.save();
			clearAndInit();
		}).dimensions(x, y, w, 20).build());
	}

	@Override
	protected void init() {
		LivelyConfig c = LivelyConfig.get();
		int col = 154;
		int left = width / 2 - col - 4;
		int right = width / 2 + 4;
		int y = 36;

		toggle(left, y, col * 2 + 8, "livelyhands.screen.master", c.enabled, k -> k.enabled = !k.enabled);
		y += 30;
		toggle(left, y, col, "livelyhands.screen.first_person", c.firstPerson, k -> k.firstPerson = !k.firstPerson);
		addDrawableChild(ButtonWidget.builder(Text.translatable("livelyhands.screen.strength", Math.round(c.intensity * 100)), b -> {
			c.intensity = next(c.intensity);
			LivelyConfig.save();
			clearAndInit();
		}).dimensions(right, y, col, 20).build());
		y += 24;
		toggle(left, y, col, "livelyhands.screen.third_person", c.thirdPerson, k -> k.thirdPerson = !k.thirdPerson);
		addDrawableChild(ButtonWidget.builder(Text.translatable("livelyhands.screen.strength", Math.round(c.thirdPersonIntensity * 100)), b -> {
			c.thirdPersonIntensity = next(c.thirdPersonIntensity);
			LivelyConfig.save();
			clearAndInit();
		}).dimensions(right, y, col, 20).build());
		y += 24;
		toggle(left, y, col, "livelyhands.screen.camera", c.camera, k -> k.camera = !k.camera);
		addDrawableChild(ButtonWidget.builder(Text.translatable("livelyhands.screen.strength", Math.round(c.cameraIntensity * 100)), b -> {
			c.cameraIntensity = next(c.cameraIntensity);
			LivelyConfig.save();
			clearAndInit();
		}).dimensions(right, y, col, 20).build());
		y += 24;
		toggle(left, y, col, "livelyhands.screen.item_physics", c.itemPhysics, k -> k.itemPhysics = !k.itemPhysics);
		y += 30;
		toggle(left, y, col, "livelyhands.screen.inertia", c.inertia, k -> k.inertia = !k.inertia);
		toggle(right, y, col, "livelyhands.screen.tilt", c.movementTilt, k -> k.movementTilt = !k.movementTilt);
		y += 24;
		toggle(left, y, col, "livelyhands.screen.jump", c.jumpAndLanding, k -> k.jumpAndLanding = !k.jumpAndLanding);
		toggle(right, y, col, "livelyhands.screen.breathing", c.idleBreathing, k -> k.idleBreathing = !k.idleBreathing);
		y += 24;
		toggle(left, y, col, "livelyhands.screen.swings", c.swingStyles, k -> k.swingStyles = !k.swingStyles);
		toggle(right, y, col, "livelyhands.screen.equip", c.equipFlip, k -> k.equipFlip = !k.equipFlip);
		y += 24;
		toggle(left, y, col, "livelyhands.screen.eating", c.eatingWobble, k -> k.eatingWobble = !k.eatingWobble);
		toggle(right, y, col, "livelyhands.screen.inspect", c.inspect, k -> k.inspect = !k.inspect);
		y += 30;
		addDrawableChild(ButtonWidget.builder(Text.translatable("gui.done"), b -> close()).dimensions(width / 2 - 100, Math.min(y, height - 26), 200, 20).build());
	}

	@Override
	public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
		super.render(ctx, mouseX, mouseY, delta);
		float t = Math.min(1f, (Util.getMeasuringTimeMs() - opened) / 250f);
		int alpha = (int) (255 * t) << 24;
		ctx.drawCenteredTextWithShadow(textRenderer, title, width / 2, 14, alpha | 0xFFB050);
		ctx.drawCenteredTextWithShadow(textRenderer, Text.translatable("livelyhands.screen.hint"), width / 2, 24, alpha | 0x9A9AA8);
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
