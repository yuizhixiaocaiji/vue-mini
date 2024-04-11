import { NodeTypes } from "./ast";
import { TO_DISPLAY_STRING } from "./runtimeHelper";

/**
 * 对给定的根节点进行转换处理。
 * @param root 根节点，表示转换的起点。
 * @param options 可选参数对象，用于配置转换过程。
 */
export function transform(root, options = {}) {
  // 1. 创建转换上下文
  const context = createTransformContext(root, options);

  // 2. 遍历 node
  traverseNode(root, context);

  // 3. 根节点生成 codegenNode
  createRootCodegen(root, context);

  // 4. 将上下文中的帮助函数添加到根节点的辅助函数列表中
  root.helpers.push(...context.helpers.keys());
}

/**
 * 遍历给定的节点，并根据节点类型执行相应的处理逻辑。
 * @param node 要遍历的节点。
 * @param context 上下文对象，包含遍历过程中的状态和工具函数。
 */
function traverseNode(node, context) {
  // 获取节点类型
  const type: NodeTypes = node.type;
  // 获取上下文中定义的节点转换函数
  const nodeTransforms = context.nodeTransforms;
  const exitFns: any = [];
  // 对每个节点转换函数执行，并收集退出时需要调用的函数
  for (let i = 0; i < nodeTransforms.length; i++) {
    const transform = nodeTransforms[i];

    const onExit = transform(node, context);
    // 如果转换函数返回了退出函数，则收集起来
    if (onExit) {
      exitFns.push(onExit);
    }
  }

  // 根据节点类型执行相应的处理逻辑
  switch (type) {
    case NodeTypes.INTERPOLATION:
      // 插值的点，在于后续生成 render 代码的时候是获取变量的值
      context.helper(TO_DISPLAY_STRING);
      break;

    case NodeTypes.ROOT:
    case NodeTypes.ELEMENT:
      // 递归处理子节点
      traverseChildren(node, context);
      break;

    default:
      break;
  }

  let i = exitFns.length;
  // i-- 这个很巧妙
  // 使用 while 是要比 for 快 (可以使用 https://jsbench.me/ 来测试一下)
  while (i--) {
    exitFns[i]();
  }
}

/**
 * 遍历给定父节点的所有子节点。
 * @param parent 父节点，其应包含一个children数组，用于遍历其子节点。
 * @param context 传递给子节点遍历过程的上下文信息，可用于共享状态或数据。
 */
function traverseChildren(parent: any, context: any) {
  // node.children
  parent.children.forEach((node) => {
    traverseNode(node, context);
  });
}

/**
 * 创建一个转换上下文对象，用于辅助节点转换过程的管理。
 * @param root 根节点，表示转换的起点。
 * @param options 配置选项，可包含节点转换函数等。
 * @returns 返回一个包含转换上下文信息的对象。
 */
function createTransformContext(root, options): any {
  // 初始化转换上下文
  const context = {
    root,
    nodeTransforms: options.nodeTransforms || [],
    helpers: new Map(),
    helper(name) {
      // 这里会收集调用的次数
      // 收集次数是为了给删除做处理的， （当只有 count 为0 的时候才需要真的删除掉）
      // helpers 数据会在后续生成代码的时候用到
      const count = context.helpers.get(name) || 0;
      context.helpers.set(name, count + 1);
    },
  };

  return context;
}

/**
 * 创建根代码生成节点
 * @param root 根节点，包含子节点信息
 * @param context 上下文信息，此处未使用
 */
function createRootCodegen(root: any, context: any) {
  const { children } = root;

  // 只支持有一个根节点, ，并且该根节点必须是一个单文本节点
  // 是一个 single text node
  const child = children[0];

  // 如果是 element 类型的话 ， 那么我们需要把它的 codegenNode 赋值给 root
  // root 其实是个空的什么数据都没有的节点
  // 所以这里需要额外的处理 codegenNode
  // codegenNode 的目的是专门为了 codegen 准备的  为的就是和 ast 的 node 分离开
  if (child.type === NodeTypes.ELEMENT && child.codegenNode) {
    const codegenNode = child.codegenNode;
    root.codegenNode = codegenNode;
  } else {
    // 如果子节点不是元素类型或没有代码生成节点，则直接将子节点赋值给根节点的代码生成节点
    root.codegenNode = child;
  }
}
