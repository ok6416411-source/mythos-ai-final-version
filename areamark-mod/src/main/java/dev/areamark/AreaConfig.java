package dev.areamark;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import net.fabricmc.loader.api.FabricLoader;

/** config/areamark.json */
public final class AreaConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE = FabricLoader.getInstance().getConfigDir().resolve("areamark.json");

	public boolean showAreas = true;
	public float fillOpacity = 1.0f;

	private static AreaConfig instance = new AreaConfig();

	public static AreaConfig get() {
		return instance;
	}

	public static void load() {
		try {
			if (Files.exists(FILE)) {
				try (Reader r = Files.newBufferedReader(FILE)) {
					AreaConfig loaded = GSON.fromJson(r, AreaConfig.class);
					if (loaded != null) {
						instance = loaded;
					}
				}
			}
		} catch (Exception e) {
			AreaMark.LOGGER.warn("Could not read {}", FILE, e);
		}
	}

	public static void save() {
		try (Writer w = Files.newBufferedWriter(FILE)) {
			GSON.toJson(instance, w);
		} catch (Exception e) {
			AreaMark.LOGGER.warn("Could not write {}", FILE, e);
		}
	}
}
