import { baseParse } from "./parse";

/**
 * 主编译函数，用于将模板字符串编译成渲染函数代码。
 * @param template 模板字符串，待编译的HTML模板。
 * @param options 编译选项，可配置额外的处理逻辑。
 * @returns 返回编译后的渲染函数代码字符串。
 */
export function baseCompile(template, options) {
  // 1. 将模板字符串解析成抽象语法树（AST）
  const ast = baseParse(template);

  // 2. 对AST进行转换处理，增强AST的功能和表现
  transform(
    ast,
    Object.assign(options, {
      nodeTransforms: [transformElement, transformText, transformExpression],
    })
  );

  // 3. 根据转换后的AST生成渲染函数的代码字符串
  return generate(ast);
}
