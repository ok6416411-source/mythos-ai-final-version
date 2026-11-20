package dev.livelyhands.mixin;

import dev.livelyhands.Motion;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.item.HeldItemRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemStack;
import net.minecraft.util.Hand;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(HeldItemRenderer.class)
public abstract class HeldItemRendererMixin {
	private static final String RENDER_HANDS =
		"renderItem(FLnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;Lnet/minecraft/client/network/ClientPlayerEntity;I)V";

	@Inject(method = RENDER_HANDS, at = @At("HEAD"))
	private void livelyhands$begin(float tickProgress, MatrixStack matrices, OrderedRenderCommandQueue queue, ClientPlayerEntity player, int light, CallbackInfo ci) {
		matrices.push();
		Motion.applyGlobal(matrices, player, tickProgress);
	}

	@Inject(method = RENDER_HANDS, at = @At("TAIL"))
	private void livelyhands$end(float tickProgress, MatrixStack matrices, OrderedRenderCommandQueue queue, ClientPlayerEntity player, int light, CallbackInfo ci) {
		matrices.pop();
	}

	@Inject(
		method = "renderFirstPersonItem",
		at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/item/HeldItemRenderer;renderItem(Lnet/minecraft/entity/LivingEntity;Lnet/minecraft/item/ItemStack;Lnet/minecraft/item/ItemDisplayContext;Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;I)V")
	)
	private void livelyhands$item(AbstractClientPlayerEntity player, float tickProgress, float pitch, Hand hand, float swingProgress, ItemStack item,
		float equipProgress, MatrixStack matrices, OrderedRenderCommandQueue queue, int light, CallbackInfo ci) {
		Motion.applyItem(matrices, player, hand, item, swingProgress, equipProgress, tickProgress);
	}
}
