package dev.swiftbuild.client.mixin;

import dev.swiftbuild.client.BuildController;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerInteractionManager;
import org.jetbrains.annotations.Nullable;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Routes right / left clicks to SwiftBuild while a build mode is active. */
@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
	@Shadow
	@Nullable
	public ClientPlayerInteractionManager interactionManager;

	@Inject(method = "doItemUse", at = @At("HEAD"), cancellable = true)
	private void swiftbuild$use(CallbackInfo ci) {
		if (BuildController.onUse((MinecraftClient) (Object) this)) {
			ci.cancel();
		}
	}

	@Inject(method = "doAttack", at = @At("HEAD"), cancellable = true)
	private void swiftbuild$attack(CallbackInfoReturnable<Boolean> cir) {
		if (BuildController.onAttack((MinecraftClient) (Object) this)) {
			cir.setReturnValue(false);
		}
	}

	@Inject(method = "handleBlockBreaking", at = @At("HEAD"), cancellable = true)
	private void swiftbuild$mining(boolean breaking, CallbackInfo ci) {
		if (breaking && BuildController.suppressMining((MinecraftClient) (Object) this)) {
			if (interactionManager != null) {
				interactionManager.cancelBlockBreaking();
			}
			ci.cancel();
		}
	}
}
