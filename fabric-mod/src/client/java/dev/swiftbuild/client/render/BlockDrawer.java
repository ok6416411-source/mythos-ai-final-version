package dev.swiftbuild.client.render;

import net.minecraft.block.BlockState;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.RenderLayers;
import net.minecraft.client.render.TexturedRenderLayers;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.VertexRendering;
import net.minecraft.client.render.model.BakedQuad;
import net.minecraft.client.render.model.BlockModelPart;
import net.minecraft.client.render.model.BlockStateModel;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.RotationAxis;
import net.minecraft.util.math.random.Random;
import net.minecraft.util.shape.VoxelShape;
import net.minecraft.util.shape.VoxelShapes;

/** Draws a block model with free scale, rotation and transparency (for holograms and animations). */
public final class BlockDrawer {
	private static final Direction[] FACES_AND_NULL = {Direction.DOWN, Direction.UP, Direction.NORTH, Direction.SOUTH, Direction.WEST, Direction.EAST, null};
	private static final Random RANDOM = Random.create();
	private static final VoxelShape CUBE = VoxelShapes.cuboid(-0.002, -0.002, -0.002, 1.002, 1.002, 1.002);

	private BlockDrawer() {
	}

	/**
	 * @param x,y,z  center of the block relative to the camera
	 * @return false if the block has no model quads (e.g. chests); callers can draw an outline instead
	 */
	public static boolean drawBlock(MatrixStack matrices, VertexConsumerProvider consumers, BlockState state, BlockPos pos,
		double x, double y, double z, float scale, float yawDegrees, float alpha, int light, float tintR, float tintG, float tintB) {
		MinecraftClient mc = MinecraftClient.getInstance();
		BlockStateModel model = mc.getBlockRenderManager().getModel(state);
		RANDOM.setSeed(42L);
		VertexConsumer buffer = consumers.getBuffer(TexturedRenderLayers.getBlockTranslucentCull());
		matrices.push();
		matrices.translate(x, y, z);
		if (yawDegrees != 0) {
			matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(yawDegrees));
		}
		matrices.scale(scale, scale, scale);
		matrices.translate(-0.5, -0.5, -0.5);
		MatrixStack.Entry entry = matrices.peek();
		boolean any = false;
		int cachedTint = Integer.MIN_VALUE;
		int tintColor = -1;
		for (BlockModelPart part : model.getParts(RANDOM)) {
			for (Direction face : FACES_AND_NULL) {
				for (BakedQuad quad : part.getQuads(face)) {
					float r = tintR, g = tintG, b = tintB;
					if (quad.hasTint()) {
						if (cachedTint != quad.tintIndex()) {
							cachedTint = quad.tintIndex();
							tintColor = mc.getBlockColors().getColor(state, mc.world, pos, cachedTint);
						}
						r *= ((tintColor >> 16) & 0xFF) / 255f;
						g *= ((tintColor >> 8) & 0xFF) / 255f;
						b *= (tintColor & 0xFF) / 255f;
					}
					buffer.quad(entry, quad, r, g, b, alpha, light, OverlayTexture.DEFAULT_UV);
					any = true;
				}
			}
		}
		matrices.pop();
		return any;
	}

	/** Outline of a single (possibly scaled) block, centered at x,y,z relative to the camera. */
	public static void drawCubeOutline(MatrixStack matrices, VertexConsumerProvider consumers, double x, double y, double z, float scale, float yawDegrees, int argb, float width) {
		matrices.push();
		matrices.translate(x, y, z);
		if (yawDegrees != 0) {
			matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(yawDegrees));
		}
		matrices.scale(scale, scale, scale);
		VertexRendering.drawOutline(matrices, consumers.getBuffer(RenderLayers.lines()), CUBE, -0.5, -0.5, -0.5, argb, width);
		matrices.pop();
	}

	/** Axis aligned box outline; coordinates are relative to the camera. */
	public static void drawBox(MatrixStack matrices, VertexConsumerProvider consumers, double x0, double y0, double z0, double x1, double y1, double z1, int argb, float width) {
		VoxelShape shape = VoxelShapes.cuboid(0, 0, 0, Math.max(0.001, x1 - x0), Math.max(0.001, y1 - y0), Math.max(0.001, z1 - z0));
		VertexRendering.drawOutline(matrices, consumers.getBuffer(RenderLayers.lines()), shape, x0, y0, z0, argb, width);
	}

	/** Translucent filled box (all six faces); coordinates are relative to the camera. */
	public static void fillBox(MatrixStack matrices, VertexConsumer buffer, float x0, float y0, float z0, float x1, float y1, float z1, int argb) {
		MatrixStack.Entry e = matrices.peek();
		// down
		buffer.vertex(e, x0, y0, z0).color(argb);
		buffer.vertex(e, x1, y0, z0).color(argb);
		buffer.vertex(e, x1, y0, z1).color(argb);
		buffer.vertex(e, x0, y0, z1).color(argb);
		// up
		buffer.vertex(e, x0, y1, z0).color(argb);
		buffer.vertex(e, x0, y1, z1).color(argb);
		buffer.vertex(e, x1, y1, z1).color(argb);
		buffer.vertex(e, x1, y1, z0).color(argb);
		// north
		buffer.vertex(e, x0, y0, z0).color(argb);
		buffer.vertex(e, x0, y1, z0).color(argb);
		buffer.vertex(e, x1, y1, z0).color(argb);
		buffer.vertex(e, x1, y0, z0).color(argb);
		// south
		buffer.vertex(e, x0, y0, z1).color(argb);
		buffer.vertex(e, x1, y0, z1).color(argb);
		buffer.vertex(e, x1, y1, z1).color(argb);
		buffer.vertex(e, x0, y1, z1).color(argb);
		// west
		buffer.vertex(e, x0, y0, z0).color(argb);
		buffer.vertex(e, x0, y0, z1).color(argb);
		buffer.vertex(e, x0, y1, z1).color(argb);
		buffer.vertex(e, x0, y1, z0).color(argb);
		// east
		buffer.vertex(e, x1, y0, z0).color(argb);
		buffer.vertex(e, x1, y1, z0).color(argb);
		buffer.vertex(e, x1, y1, z1).color(argb);
		buffer.vertex(e, x1, y0, z1).color(argb);
	}
}
