package dev.livelyhands.mixin;

import dev.livelyhands.CameraMotion;
import net.minecraft.client.render.GameRenderer;
import net.minecraft.client.util.math.MatrixStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
	@Inject(method = "tiltViewWhenHurt", at = @At("RETURN"))
	private void livelyhands$camera(MatrixStack matrices, float tickProgress, CallbackInfo ci) {
		CameraMotion.apply(matrices, tickProgress);
	}
}
