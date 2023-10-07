import { SupportedElement, Options } from './types'
import { embedResources } from './embed-resources'
import { toArray, isInstanceOfElement, isSupportedElement } from './util'
import { isDataUrl, resourceToDataURL } from './dataurl'
import { getMimeType } from './mimes'

async function embedProp(
  propName: string,
  node: SupportedElement,
  options: Options,
) {
  const propValue = node.style?.getPropertyValue(propName)
  if (propValue) {
    const cssString = await embedResources(propValue, null, options)
    node.style.setProperty(
      propName,
      cssString,
      node.style.getPropertyPriority(propName),
    )
    return true
  }
  return false
}

async function embedBackground(clonedNode: SupportedElement, options: Options) {
  if (!(await embedProp('background', clonedNode, options))) {
    await embedProp('background-image', clonedNode, options)
  }
  if (!(await embedProp('mask', clonedNode, options))) {
    await embedProp('mask-image', clonedNode, options)
  }
}

async function embedImageNode(clonedNode: SupportedElement, options: Options) {
  const isHTMLImageElement = isInstanceOfElement(clonedNode, HTMLImageElement)
  const isSVGImageElement = isInstanceOfElement(clonedNode, SVGImageElement)

  if (
    !(isHTMLImageElement && !isDataUrl(clonedNode.src)) &&
    !(isSVGImageElement && !isDataUrl(clonedNode.href.baseVal))
  ) {
    return
  }

  const url = isHTMLImageElement ? clonedNode.src : clonedNode.href.baseVal

  const dataURL = await resourceToDataURL(url, getMimeType(url), options)
  await new Promise((resolve, reject) => {
    clonedNode.onload = resolve
    clonedNode.onerror = reject

    const image = clonedNode as HTMLImageElement
    if (image.decode) {
      image.decode = resolve as any
    }

    if (image.loading === 'lazy') {
      image.loading = 'eager'
    }

    if (isHTMLImageElement) {
      clonedNode.srcset = ''
      clonedNode.src = dataURL
    } else {
      clonedNode.href.baseVal = dataURL
    }
  })
}

async function embedChildren(clonedNode: SupportedElement, options: Options) {
  const children = toArray(clonedNode.childNodes)
  const deferreds = children.map((child) => embedImages(child, options))
  await Promise.all(deferreds).then(() => clonedNode)
}

export async function embedImages(clonedNode: Node, options: Options) {
  if (isSupportedElement(clonedNode)) {
    await embedBackground(clonedNode, options)
    await embedImageNode(clonedNode, options)
    await embedChildren(clonedNode, options)
  }
}
