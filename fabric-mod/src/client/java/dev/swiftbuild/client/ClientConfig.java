package dev.swiftbuild.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import dev.swiftbuild.SwiftBuild;
import dev.swiftbuild.build.BuildMode;
import dev.swiftbuild.build.FillMode;
import dev.swiftbuild.build.Modifiers;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

/** Client choices that survive restarts, stored in config/swiftbuild-client.json. */
public final class ClientConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("swiftbuild-client.json");

	public BuildMode mode = BuildMode.VANILLA;
	public FillMode fill = FillMode.FILLED;
	public Modifiers modifiers = Modifiers.NONE;
	public boolean mix = false;
	public boolean animations = true;
	public boolean preview = true;
	public boolean hud = true;

	private static ClientConfig instance = new ClientConfig();

	public static ClientConfig get() {
		return instance;
	}

	public static void load() {
		try {
			if (Files.exists(FILE)) {
				try (Reader reader = Files.newBufferedReader(FILE)) {
					ClientConfig loaded = GSON.fromJson(reader, ClientConfig.class);
					if (loaded != null) {
						if (loaded.mode == null) loaded.mode = BuildMode.VANILLA;
						if (loaded.fill == null) loaded.fill = FillMode.FILLED;
						loaded.modifiers = loaded.modifiers == null ? Modifiers.NONE : loaded.modifiers.sanitized();
						instance = loaded;
					}
				}
			}
		} catch (Exception e) {
			SwiftBuild.LOGGER.warn("Could not read {}, using defaults", FILE, e);
		}
	}

	public static void save() {
		try (Writer writer = Files.newBufferedWriter(FILE)) {
			GSON.toJson(instance, writer);
		} catch (Exception e) {
			SwiftBuild.LOGGER.warn("Could not write {}", FILE, e);
		}
	}
}
