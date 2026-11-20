package dev.areamark;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.world.WorldRenderEvents;
import net.fabricmc.fabric.api.event.client.player.ClientPreAttackCallback;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AreaMark implements ClientModInitializer {
	public static final String MOD_ID = "areamark";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
	public static final KeyBinding.Category CATEGORY = KeyBinding.Category.create(Identifier.of(MOD_ID, "main"));
	public static KeyBinding markKey;
	public static KeyBinding listKey;
	public static KeyBinding hideKey;

	@Override
	public void onInitializeClient() {
		AreaConfig.load();
		markKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.areamark.mark", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_G, CATEGORY));
		listKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.areamark.list", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_H, CATEGORY));
		hideKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.areamark.hide", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_UNKNOWN, CATEGORY));

		ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> client.execute(() -> AreaStore.onJoin(client)));
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> client.execute(() -> {
			Marker.cancel();
			AreaStore.onLeave();
		}));

		ClientTickEvents.END_CLIENT_TICK.register(client -> {
			AreaStore.tick();
			while (markKey.wasPressed()) {
				if (client.player != null) {
					Marker.toggle(client);
				}
			}
			while (listKey.wasPressed()) {
				if (client.player != null && client.currentScreen == null) {
					client.setScreen(new AreaScreen());
				}
			}
			while (hideKey.wasPressed()) {
				AreaConfig.get().showAreas = !AreaConfig.get().showAreas;
				AreaConfig.save();
			}
		});

		// Marking mode: clicks select corners instead of breaking / placing.
		ClientPreAttackCallback.EVENT.register((client, player, clickCount) -> {
			if (!Marker.active()) {
				return false;
			}
			if (clickCount > 0) {
				Marker.leftClick(client);
			}
			return true;
		});
		UseBlockCallback.EVENT.register((player, world, hand, hit) -> {
			if (world.isClient() && Marker.active()) {
				Marker.rightClick(MinecraftClient.getInstance());
				return ActionResult.FAIL;
			}
			return ActionResult.PASS;
		});
		UseItemCallback.EVENT.register((player, world, hand) -> {
			if (world.isClient() && Marker.active()) {
				Marker.rightClick(MinecraftClient.getInstance());
				return ActionResult.FAIL;
			}
			return ActionResult.PASS;
		});

		WorldRenderEvents.AFTER_ENTITIES.register(AreaRender::render);
		HudElementRegistry.addLast(Identifier.of(MOD_ID, "hud"), MarkHud::render);
	}
}
