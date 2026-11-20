package dev.livelyhands;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.resource.v1.ResourceLoader;
import net.fabricmc.fabric.api.resource.v1.pack.PackActivationType;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import org.lwjgl.glfw.GLFW;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LivelyHands implements ClientModInitializer {
	public static final String MOD_ID = "livelyhands";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
	public static final KeyBinding.Category CATEGORY = KeyBinding.Category.create(Identifier.of(MOD_ID, "main"));
	public static KeyBinding inspectKey;
	public static KeyBinding toggleKey;
	public static KeyBinding settingsKey;

	@Override
	public void onInitializeClient() {
		LivelyConfig.load();

		inspectKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.livelyhands.inspect", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_I, CATEGORY));
		toggleKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.livelyhands.toggle", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_K, CATEGORY));
		settingsKey = KeyBindingHelper.registerKeyBinding(new KeyBinding("key.livelyhands.settings", InputUtil.Type.KEYSYM, GLFW.GLFW_KEY_O, CATEGORY));

		ClientTickEvents.END_CLIENT_TICK.register(client -> {
			while (inspectKey.wasPressed()) {
				Motion.startInspect();
			}
			while (toggleKey.wasPressed()) {
				LivelyConfig c = LivelyConfig.get();
				c.enabled = !c.enabled;
				LivelyConfig.save();
				if (client.player != null) {
					client.player.sendMessage(Text.translatable(c.enabled ? "livelyhands.msg.on" : "livelyhands.msg.off"), true);
				}
			}
			while (settingsKey.wasPressed()) {
				if (client.currentScreen == null) {
					client.setScreen(new LivelyScreen(null));
				}
			}
			Motion.tick(client);
			CameraMotion.tick(client);
		});

		// Impact feedback: recoil + screen shake when hitting mobs or breaking blocks.
		net.fabricmc.fabric.api.event.player.AttackEntityCallback.EVENT.register((player, world, hand, entity, hit) -> {
			if (world.isClient()) {
				Motion.recoil(0.6f);
				CameraMotion.shake(0.35f);
			}
			return net.minecraft.util.ActionResult.PASS;
		});
		net.fabricmc.fabric.api.event.client.player.ClientPlayerBlockBreakEvents.AFTER.register((world, player, pos, state) -> {
			Motion.recoil(0.35f);
			CameraMotion.shake(0.12f);
		});

		// Built-in resource pack: new holding poses for tools, items and blocks, plus a crosshair.
		FabricLoader.getInstance().getModContainer(MOD_ID).ifPresent(container ->
			ResourceLoader.registerBuiltinPack(Identifier.of(MOD_ID, "lively_pack"), container,
				Text.translatable("livelyhands.pack.name"), PackActivationType.DEFAULT_ENABLED));
	}
}
