package dev.swiftbuild;

import dev.swiftbuild.net.AnimationPayload;
import dev.swiftbuild.net.BuildRequestPayload;
import dev.swiftbuild.net.HelloPayload;
import dev.swiftbuild.net.UndoPayload;
import dev.swiftbuild.server.BuildService;
import dev.swiftbuild.server.ServerConfig;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SwiftBuild implements ModInitializer {
	public static final String MOD_ID = "swiftbuild";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	public static Identifier id(String path) {
		return Identifier.of(MOD_ID, path);
	}

	@Override
	public void onInitialize() {
		ServerConfig.load();

		PayloadTypeRegistry.playC2S().register(BuildRequestPayload.ID, BuildRequestPayload.CODEC);
		PayloadTypeRegistry.playC2S().register(UndoPayload.ID, UndoPayload.CODEC);
		PayloadTypeRegistry.playS2C().register(HelloPayload.ID, HelloPayload.CODEC);
		PayloadTypeRegistry.playS2C().register(AnimationPayload.ID, AnimationPayload.CODEC);

		ServerPlayNetworking.registerGlobalReceiver(BuildRequestPayload.ID, (payload, context) -> BuildService.handleBuild(context.player(), payload));
		ServerPlayNetworking.registerGlobalReceiver(UndoPayload.ID, (payload, context) -> BuildService.handleUndo(context.player(), payload.redo()));

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			ServerConfig c = ServerConfig.get();
			sender.sendPacket(new HelloPayload(c.reachCreative, c.reachSurvival, c.maxBlocksCreative, c.maxBlocksSurvival));
		});
		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> BuildService.forget(handler.player.getUuid()));
		ServerTickEvents.END_SERVER_TICK.register(BuildService::tick);
		ServerLifecycleEvents.SERVER_STOPPING.register(BuildService::flushAll);

		LOGGER.info("SwiftBuild ready");
	}
}
