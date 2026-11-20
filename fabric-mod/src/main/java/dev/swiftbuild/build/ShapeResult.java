package dev.swiftbuild.build;

import java.util.List;
import net.minecraft.util.math.BlockPos;

/** Positions produced by the shape generator. {@code truncated} means the limit was hit. */
public record ShapeResult(List<BlockPos> positions, boolean truncated) {
}
