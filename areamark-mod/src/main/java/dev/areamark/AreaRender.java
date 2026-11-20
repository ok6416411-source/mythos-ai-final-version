package dev.areamark;

import net.fabricmc.fabric.api.client.rendering.v1.world.WorldRenderContext;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.render.LightmapTextureManager;
import net.minecraft.client.render.RenderLayers;
import net.minecraft.client.render.VertexConsumer;
import net.minecraft.client.render.VertexConsumerProvider;
import net.minecraft.client.render.VertexRendering;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.Util;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.shape.VoxelShapes;
import org.joml.Matrix4f;
import org.joml.Quaternionf;

/**
 * Draws the marked areas and the live selection. Everything moves: areas grow out of their
 * first corner when saved, the fill breathes, a light band sweeps up and down the sides, labels
 * pop in and float, removed areas shrink away, and selection corners spin.
 */
public final class AreaRender {
	private static final double MAX_LABEL_DIST = 96;

	private AreaRender() {
	}

	public static void render(WorldRenderContext context) {
		MinecraftClient mc = MinecraftClient.getInstance();
		if (mc.world == null || mc.player == null || mc.options.hudHidden) {
			return;
		}
		MatrixStack matrices = context.matrices();
		VertexConsumerProvider consumers = context.consumers();
		Vec3d cam = context.worldState().cameraRenderState.pos;
		Quaternionf orientation = context.worldState().cameraRenderState.orientation;
		long now = Util.getMeasuringTimeMs();
		String dim = AreaStore.currentDim();

		if (AreaConfig.get().showAreas) {
			for (Area a : AreaStore.all()) {
				if (!a.visible || !a.dim.equals(dim)) {
					continue;
				}
				renderArea(mc, matrices, consumers, orientation, cam, a, now);
			}
		}
		if (Marker.active()) {
			renderSelection(mc, matrices, consumers, orientation, cam, now);
		}
	}

	private static void renderArea(MinecraftClient mc, MatrixStack matrices, VertexConsumerProvider consumers, Quaternionf orientation, Vec3d cam, Area a, long now) {
		double x0 = a.minX, y0 = a.minY, z0 = a.minZ, x1 = a.maxX + 1, y1 = a.maxY + 1, z1 = a.maxZ + 1;

		// Grow out of the first corner.
		float grow = Ease.outBack((now - a.appearAt) / 600f);
		if (grow < 1f && a.origin != null) {
			double ox0 = a.origin.getX(), oy0 = a.origin.getY(), oz0 = a.origin.getZ();
			x0 = MathHelper.lerp(grow, ox0, x0);
			y0 = MathHelper.lerp(grow, oy0, y0);
			z0 = MathHelper.lerp(grow, oz0, z0);
			x1 = MathHelper.lerp(grow, ox0 + 1, x1);
			y1 = MathHelper.lerp(grow, oy0 + 1, y1);
			z1 = MathHelper.lerp(grow, oz0 + 1, z1);
		}
		// Shrink into the centre when removed.
		float fade = 1f;
		if (a.removingAt >= 0) {
			float t = Ease.inCubic((now - a.removingAt) / (float) AreaStore.COLLAPSE_MS);
			double cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
			x0 = MathHelper.lerp(t, x0, cx);
			y0 = MathHelper.lerp(t, y0, cy);
			z0 = MathHelper.lerp(t, z0, cz);
			x1 = MathHelper.lerp(t, x1, cx);
			y1 = MathHelper.lerp(t, y1, cy);
			z1 = MathHelper.lerp(t, z1, cz);
			fade = 1 - t;
		}
		float appearFade = Ease.clamp((now - a.appearAt) / 300f);
		float pulse = 0.5f + 0.5f * MathHelper.sin(now / 1000f * 2.4f + a.minX * 0.37f);
		float e = 0.012f;

		// Fill.
		VertexConsumer quads = consumers.getBuffer(RenderLayers.debugQuads());
		int fill = Ease.withAlpha(a.color, (0.16f + 0.1f * pulse) * fade * appearFade * AreaConfig.get().fillOpacity);
		box(matrices, quads, x0 - cam.x - e, y0 - cam.y - e, z0 - cam.z - e, x1 - cam.x + e, y1 - cam.y + e, z1 - cam.z + e, fill);

		// Sweeping light band on the sides.
		double height = y1 - y0;
		if (height > 0.05) {
			float sweep = 0.5f + 0.5f * MathHelper.sin(now / 1000f * 1.3f + a.minZ * 0.21f);
			double by = y0 + sweep * Math.max(0, height - 0.12);
			int band = Ease.withAlpha(0xFFFFFF, 0.35f * fade * appearFade);
			box(matrices, quads, x0 - cam.x - e * 2, by - cam.y, z0 - cam.z - e * 2, x1 - cam.x + e * 2, by + 0.12 - cam.y, z1 - cam.z + e * 2, band);
		}

		// Outline: soft wide glow + crisp line.
		outline(matrices, consumers, x0, y0, z0, x1, y1, z1, cam, Ease.withAlpha(a.color, 0.35f * fade), 5f);
		outline(matrices, consumers, x0, y0, z0, x1, y1, z1, cam, Ease.withAlpha(a.color, fade), 2f);

		// Label above the top centre.
		Vec3d top = new Vec3d((x0 + x1) / 2, y1, (z0 + z1) / 2);
		double dist = top.distanceTo(cam);
		float pop = Ease.outBack((now - a.appearAt - 200) / 500f) * fade;
		if (pop > 0.01f && dist < MAX_LABEL_DIST) {
			float bob = MathHelper.sin(now / 1000f * 2f + a.minY) * 0.06f;
			float size = (float) (0.025 * Math.max(1.0, dist / 10.0)) * pop;
			label(mc.textRenderer, matrices, consumers, orientation, top.add(0, 0.6 + bob, 0).subtract(cam), size,
				a.name, a.sizeText(), a.color, fade);
		}
	}

	private static void renderSelection(MinecraftClient mc, MatrixStack matrices, VertexConsumerProvider consumers, Quaternionf orientation, Vec3d cam, long now) {
		float delta = mc.getRenderTickCounter().getTickProgress(true);
		BlockPos target = Marker.target(mc, delta);
		BlockPos p1 = Marker.pos1();
		BlockPos p2 = Marker.pos2() != null ? Marker.pos2() : (p1 != null ? target : null);
		// Marching colour so the live selection is clearly "in progress".
		float hue = (now % 3000L) / 3000f;
		int live = 0xFF000000 | MathHelper.hsvToRgb(hue, 0.55f, 1f);

		if (target != null && p1 == null) {
			float pulse = 0.5f + 0.5f * MathHelper.sin(now / 1000f * 6f);
			cube(matrices, consumers, cam, target, 1.0f + 0.04f * pulse, 0, Ease.withAlpha(live, 0.9f), 2.5f);
		}
		if (p1 != null) {
			BlockPos a = p1;
			BlockPos b = p2 == null ? p1 : p2;
			double x0 = Math.min(a.getX(), b.getX()), y0 = Math.min(a.getY(), b.getY()), z0 = Math.min(a.getZ(), b.getZ());
			double x1 = Math.max(a.getX(), b.getX()) + 1, y1 = Math.max(a.getY(), b.getY()) + 1, z1 = Math.max(a.getZ(), b.getZ()) + 1;
			VertexConsumer quads = consumers.getBuffer(RenderLayers.debugQuads());
			float e = 0.015f;
			box(matrices, quads, x0 - cam.x - e, y0 - cam.y - e, z0 - cam.z - e, x1 - cam.x + e, y1 - cam.y + e, z1 - cam.z + e, Ease.withAlpha(live, 0.14f));
			outline(matrices, consumers, x0, y0, z0, x1, y1, z1, cam, live, 2.5f);

			float spin = (now % 2000L) / 2000f * 360f;
			float pop1 = Ease.outBack((now - Marker.pos1At()) / 400f);
			cube(matrices, consumers, cam, a, 0.5f * pop1, spin, 0xFFFFFFFF, 3f);
			if (Marker.pos2() != null) {
				float pop2 = Ease.outBack((now - Marker.pos2At()) / 400f);
				cube(matrices, consumers, cam, Marker.pos2(), 0.5f * pop2, -spin, 0xFFFFFFFF, 3f);
			}
			int sx = (int) (x1 - x0), sy = (int) (y1 - y0), sz = (int) (z1 - z0);
			Vec3d top = new Vec3d((x0 + x1) / 2, y1, (z0 + z1) / 2);
			double dist = top.distanceTo(cam);
			float size = (float) (0.025 * Math.max(1.0, dist / 10.0));
			label(mc.textRenderer, matrices, consumers, orientation, top.add(0, 0.6, 0).subtract(cam), size,
				sx + "×" + sy + "×" + sz, String.valueOf((long) sx * sy * sz), live, 1f);
		}
	}

	private static void cube(MatrixStack matrices, VertexConsumerProvider consumers, Vec3d cam, BlockPos pos, float scale, float spin, int color, float width) {
		matrices.push();
		matrices.translate(pos.getX() + 0.5 - cam.x, pos.getY() + 0.5 - cam.y, pos.getZ() + 0.5 - cam.z);
		if (spin != 0) {
			matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(spin));
		}
		matrices.scale(scale, scale, scale);
		VertexRendering.drawOutline(matrices, consumers.getBuffer(RenderLayers.lines()), VoxelShapes.fullCube(), -0.5, -0.5, -0.5, color, width);
		matrices.pop();
	}

	private static void outline(MatrixStack matrices, VertexConsumerProvider consumers, double x0, double y0, double z0, double x1, double y1, double z1,
		Vec3d cam, int color, float width) {
		if ((color >>> 24) < 3) {
			return;
		}
		VertexRendering.drawOutline(matrices, consumers.getBuffer(RenderLayers.lines()),
			VoxelShapes.cuboid(0, 0, 0, Math.max(0.001, x1 - x0), Math.max(0.001, y1 - y0), Math.max(0.001, z1 - z0)),
			x0 - cam.x, y0 - cam.y, z0 - cam.z, color, width);
	}

	private static void box(MatrixStack matrices, VertexConsumer b, double dx0, double dy0, double dz0, double dx1, double dy1, double dz1, int c) {
		if ((c >>> 24) < 2) {
			return;
		}
		Matrix4f m = matrices.peek().getPositionMatrix();
		float x0 = (float) dx0, y0 = (float) dy0, z0 = (float) dz0, x1 = (float) dx1, y1 = (float) dy1, z1 = (float) dz1;
		b.vertex(m, x0, y0, z0).color(c); b.vertex(m, x1, y0, z0).color(c); b.vertex(m, x1, y0, z1).color(c); b.vertex(m, x0, y0, z1).color(c);
		b.vertex(m, x0, y1, z0).color(c); b.vertex(m, x0, y1, z1).color(c); b.vertex(m, x1, y1, z1).color(c); b.vertex(m, x1, y1, z0).color(c);
		b.vertex(m, x0, y0, z0).color(c); b.vertex(m, x0, y1, z0).color(c); b.vertex(m, x1, y1, z0).color(c); b.vertex(m, x1, y0, z0).color(c);
		b.vertex(m, x0, y0, z1).color(c); b.vertex(m, x1, y0, z1).color(c); b.vertex(m, x1, y1, z1).color(c); b.vertex(m, x0, y1, z1).color(c);
		b.vertex(m, x0, y0, z0).color(c); b.vertex(m, x0, y0, z1).color(c); b.vertex(m, x0, y1, z1).color(c); b.vertex(m, x0, y1, z0).color(c);
		b.vertex(m, x1, y0, z0).color(c); b.vertex(m, x1, y1, z0).color(c); b.vertex(m, x1, y1, z1).color(c); b.vertex(m, x1, y0, z1).color(c);
	}

	private static void label(TextRenderer tr, MatrixStack matrices, VertexConsumerProvider consumers, Quaternionf orientation, Vec3d rel,
		float size, String title, String sub, int color, float alpha) {
		matrices.push();
		matrices.translate(rel.x, rel.y, rel.z);
		matrices.multiply(orientation);
		matrices.scale(size, -size, size);
		Matrix4f m = matrices.peek().getPositionMatrix();
		int light = LightmapTextureManager.MAX_LIGHT_COORDINATE;
		int bg = Ease.alpha(0x99000000, alpha);
		tr.draw(title, -tr.getWidth(title) / 2f, -10, Ease.withAlpha(color, alpha), false, m, consumers, TextRenderer.TextLayerType.SEE_THROUGH, bg, light);
		tr.draw(sub, -tr.getWidth(sub) / 2f, 1, Ease.withAlpha(0xFFFFFF, alpha), false, m, consumers, TextRenderer.TextLayerType.SEE_THROUGH, bg, light);
		matrices.pop();
	}
}
