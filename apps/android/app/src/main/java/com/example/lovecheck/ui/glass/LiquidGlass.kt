package com.example.lovecheck.ui.glass

import android.os.Build
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.VectorConverter
import androidx.compose.animation.core.spring
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.layer.GraphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChangeIgnoreConsumed
import androidx.compose.ui.unit.dp
import com.kyant.backdrop.Backdrop
import com.kyant.backdrop.backdrops.LayerBackdrop
import com.kyant.backdrop.backdrops.rememberLayerBackdrop
import com.kyant.backdrop.drawBackdrop
import com.kyant.backdrop.effects.blur
import com.kyant.backdrop.effects.colorControls
import com.kyant.backdrop.effects.lens
import com.kyant.backdrop.effects.vibrancy
import com.kyant.backdrop.highlight.Highlight
import kotlin.math.abs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

typealias PlatformBackdrop = LayerBackdrop

@Composable
fun rememberBackdrop(): PlatformBackdrop = rememberLayerBackdrop()

private class GlassInteraction(private val animationScope: CoroutineScope) {
    private val progressAnim = Animatable(0f)
    private val offsetAnim = Animatable(Offset.Zero, Offset.VectorConverter)

    val progress: Float get() = progressAnim.value
    val offset: Offset get() = offsetAnim.value
    var touchPosition: Offset? = null
        private set

    fun onPress(position: Offset) {
        touchPosition = position
        animationScope.launch {
            launch {
                progressAnim.animateTo(
                    1f,
                    spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness = Spring.StiffnessMediumLow,
                    ),
                )
            }
            launch { offsetAnim.snapTo(Offset.Zero) }
        }
    }

    fun onDrag(dragDelta: Offset) {
        touchPosition = touchPosition?.plus(dragDelta)
        animationScope.launch {
            offsetAnim.snapTo(offsetAnim.value + dragDelta)
        }
    }

    fun onRelease() {
        animationScope.launch {
            launch {
                progressAnim.animateTo(
                    0f,
                    spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness = Spring.StiffnessMediumLow,
                    ),
                )
            }
            launch {
                offsetAnim.animateTo(
                    Offset.Zero,
                    spring(
                        dampingRatio = Spring.DampingRatioMediumBouncy,
                        stiffness = Spring.StiffnessMediumLow,
                    ),
                )
            }
        }
    }
}

private suspend fun PointerInputScope.inspectDragGestures(
    onDragStart: (down: Offset) -> Unit = {},
    onDragEnd: () -> Unit = {},
    onDragCancel: () -> Unit = {},
    onDrag: (dragAmount: Offset) -> Unit,
) {
    awaitEachGesture {
        val down = awaitFirstDown(false, PointerEventPass.Initial)
        onDragStart(down.position)
        onDrag(Offset.Zero)

        var pointer = down
        while (true) {
            val event = awaitPointerEvent(PointerEventPass.Initial)
            val dragEvent = event.changes.firstOrNull { it.id == pointer.id }

            if (dragEvent == null || dragEvent.changedToUpIgnoreConsumed()) {
                val otherDown = event.changes.firstOrNull { it.pressed }
                if (otherDown != null) {
                    pointer = otherDown
                } else {
                    onDragEnd()
                    break
                }
            } else {
                val posChange = dragEvent.positionChangeIgnoreConsumed()
                if (posChange != Offset.Zero) {
                    onDrag(posChange)
                }
            }
        }
    }
}

private fun Modifier.drawInteractiveGlass(
    backdrop: Backdrop,
    shape: Shape,
    isInteractive: Boolean,
    tintColor: Color = Color.White,
    surfaceAlpha: Float = 0.06f,
    maxScale: Float = 1.28f,
    interaction: GlassInteraction?,
    customModifier: Modifier = Modifier,
) = this.drawBackdrop(
    backdrop = backdrop,
    shape = { shape },
    effects = {
        val progress = interaction?.progress ?: 0f
        vibrancy()
        colorControls(brightness = 0.02f, contrast = 1.05f, saturation = 1.35f)
        blur((2f + 1.5f * progress).dp.toPx())
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            lens(
                refractionHeight = (8f + 4f * progress).dp.toPx(),
                refractionAmount = (24f + 12f * progress).dp.toPx(),
                depthEffect = true,
                chromaticAberration = isInteractive && progress > 0.01f,
            )
        }
    },
    highlight = { Highlight.Ambient },
    shadow = null,
    layerBlock = if (isInteractive && interaction != null) {
        {
            val width = size.width
            val height = size.height
            val progress = interaction.progress
            val scale = 1f + (maxScale - 1f) * progress

            val offset = interaction.offset
            val maxOffset = minOf(width, height) * 0.15f
            translationX = maxOffset * kotlin.math.tanh(offset.x / (maxOffset * 2f).coerceAtLeast(1f))
            translationY = maxOffset * kotlin.math.tanh(offset.y / (maxOffset * 2f).coerceAtLeast(1f))

            val maxDragScale = 0.08f
            val aspectScale = (abs(offset.x) - abs(offset.y)) / minOf(width, height).coerceAtLeast(1f)
            scaleX = scale + maxDragScale * kotlin.math.tanh(aspectScale)
            scaleY = scale - maxDragScale * kotlin.math.tanh(aspectScale)
        }
    } else {
        null
    },
    onDrawSurface = {
        drawRect(tintColor.copy(alpha = surfaceAlpha))
        if (isInteractive && interaction != null) {
            val progress = interaction.progress
            if (progress > 0.001f) {
                val center = interaction.touchPosition ?: this.center
                val radius = size.minDimension * 1.25f
                drawRect(
                    brush = Brush.radialGradient(
                        colors = listOf(
                            tintColor.copy(alpha = 0.36f * progress),
                            tintColor.copy(alpha = 0.15f * progress),
                            Color.Transparent,
                        ),
                        center = center,
                        radius = radius.coerceAtLeast(1f),
                    ),
                    blendMode = BlendMode.Plus,
                )
            }
        }
    },
).then(customModifier)

fun Modifier.liquidGlass(
    backdrop: PlatformBackdrop,
    shape: Shape,
    isInteractive: Boolean = true,
    tintColor: Color = Color.White,
    surfaceAlpha: Float = 0.06f,
    maxScale: Float = 1.28f,
    layer: GraphicsLayer? = null,
    luminanceAnimation: Animatable<Float, *>? = null,
): Modifier = composed {
    val interaction = if (isInteractive) {
        val scope = androidx.compose.runtime.rememberCoroutineScope()
        remember(scope) { GlassInteraction(scope) }
    } else {
        null
    }

    val luminanceMod = if (layer != null && luminanceAnimation != null) {
        Modifier.drawWithContent {
            drawContent()
            layer.record { this@drawWithContent.drawContent() }
        }.graphicsLayer {
            val l = luminanceAnimation.value
            val contrast = 1f + 0.2f * (1f - l)
            alpha = 0.99f + 0.01f * contrast
        }
    } else {
        Modifier
    }

    val gestureMod = if (isInteractive && interaction != null) {
        Modifier.pointerInput(interaction) {
            inspectDragGestures(
                onDragStart = { down -> interaction.onPress(down) },
                onDragEnd = { interaction.onRelease() },
                onDragCancel = { interaction.onRelease() },
            ) { dragAmount ->
                interaction.onDrag(dragAmount)
            }
        }
    } else {
        Modifier
    }

    this.drawInteractiveGlass(
        backdrop = backdrop,
        shape = shape,
        isInteractive = isInteractive,
        tintColor = tintColor,
        surfaceAlpha = surfaceAlpha,
        maxScale = maxScale,
        interaction = interaction,
        customModifier = luminanceMod.then(gestureMod),
    )
}
