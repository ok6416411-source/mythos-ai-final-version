package dev.livelyhands.mixin;

import dev.livelyhands.Hanging;
import dev.livelyhands.ThirdPerson;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.entity.feature.HeldItemFeatureRenderer;
import net.minecraft.client.render.entity.state.ArmedEntityRenderState;
import net.minecraft.client.render.item.ItemRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemStack;
import net.minecraft.util.Arm;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Third person: buckets and lanterns swing from other players' hands. */
@Mixin(HeldItemFeatureRenderer.class)
public abstract class HeldItemFeatureRendererMixin {
	@Inject(
		method = "renderItem",
		at = @At(value = "INVOKE", target = "Lnet/minecraft/client/render/item/ItemRenderState;render(Lnet/minecraft/client/util/math/MatrixStack;Lnet/minecraft/client/render/command/OrderedRenderCommandQueue;III)V")
	)
	private void livelyhands$swing(ArmedEntityRenderState state, ItemRenderState itemState, ItemStack stack, Arm arm, MatrixStack matrices,
		OrderedRenderCommandQueue queue, int light, CallbackInfo ci) {
		ThirdPerson.Pose pose = state.getData(ThirdPerson.POSE);
		Hanging.Kind kind = Hanging.kind(stack);
		if (pose != null && kind != Hanging.Kind.NONE) {
			Hanging.swingThirdPerson(matrices, kind, pose.swingForward(), pose.swingSide() * (arm == Arm.RIGHT ? 1 : -1));
		}
	}
}
