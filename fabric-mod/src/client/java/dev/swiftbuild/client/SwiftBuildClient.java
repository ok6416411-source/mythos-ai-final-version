package dev.swiftbuild.client;

import dev.swiftbuild.SwiftBuild;
import dev.swiftbuild.client.gui.BuildHud;
import dev.swiftbuild.client.gui.ModifierScreen;
import dev.swiftbuild.client.gui.RadialMenuScreen;
import dev.swiftbuild.client.render.AnimationManager;
import dev.swiftbuild.client.render.WorldOverlay;
import dev.swiftbuild.net.AnimationPayload;
import dev.swiftbuild.net.HelloPayload;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.world.WorldRenderEvents;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

public class SwiftBuildClient implements ClientModInitializer {
	public static final KeyBinding.Category CATEGORY = KeyBinding.Category.create(SwiftBuild.id("main"));
	public static KeyBinding menuKey;
	public static KeyBinding undoKey;
	public static KeyBinding redoKey;
	public static KeyBinding modifiersKey;

	@Override
	public void onInitializeClient() {
		ClientConfig.load();

		menuKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.swiftbuild.menu", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_LEFT_ALT, CATEGORY));
		undoKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.swiftbuild.undo", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_Z, CATEGORY));
		redoKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.swiftbuild.redo", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_Y, CATEGORY));
		modifiersKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.swiftbuild.modifiers", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_N, CATEGORY));

		ClientPlayNetworking.registerGlobalReceiver(HelloPayload.ID, (payload, context) -> {
			BuildController.serverSupported = true;
			BuildController.limits = payload;
		});
		ClientPlayNetworking.registerGlobalReceiver(AnimationPayload.ID, (payload, context) -> AnimationManager.accept(payload));
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> client.execute(() -> {
			BuildController.serverSupported = false;
			BuildController.cancel();
			AnimationManager.clear();
		}));

		ClientTickEvents.END_CLIENT_TICK.register(client -> {
			BuildController.tick(client);
			while (menuKey.wasPressed()) {
				if (client.currentScreen == null && client.player != null) {
					if (BuildController.serverSupported) {
						client.setScreen(new RadialMenuScreen(menuKey));
					} else {
						client.player.sendMessage(Text.translatable("swiftbuild.hud.no_server"), true);
					}
				}
			}
			while (modifiersKey.wasPressed()) {
				if (client.currentScreen == null) {
					client.setScreen(new ModifierScreen(null));
				}
			}
			while (undoKey.wasPressed()) {
				BuildController.undo(false);
			}
			while (redoKey.wasPressed()) {
				BuildController.undo(true);
			}
		});

		WorldRenderEvents.AFTER_ENTITIES.register(WorldOverlay::render);
		HudElementRegistry.addLast(SwiftBuild.id("hud"), BuildHud::render);

		if (Boolean.getBoolean("swiftbuild.demo")) {
			// Development-only screenshot script; the class is not shipped in the release jar.
			try {
				Class.forName("dev.swiftbuild.client.demo.DemoDriver").getMethod("install").invoke(null);
			} catch (ReflectiveOperationException e) {
				SwiftBuild.LOGGER.warn("Demo driver not available", e);
			}
		}
	}
}
