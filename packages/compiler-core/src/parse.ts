const enum TagType {
  Start,
  End,
}

/**
 * 解析给定的内容，并生成根节点。
 * @param content 要解析的字符串内容。
 * @returns 返回一个根节点，它包含了从给定字符串解析出的子节点。
 */
export function baseParse(content: string) {
  // 创建解析上下文
  const context = createParserContext(content);
  // 使用解析上下文解析子节点，并创建根节点返回
  return createRoot(parseChildren(context, []));
}

/**
 * 创建解析上下文
 * @param content 要解析的内容，类型为字符串
 * @return 返回一个包含源内容的解析上下文对象
 */
function createParserContext(content: string) {
  // 创建 parseContext
  return {
    source: content,
  };
}

/**
 * 解析子节点。
 * @param context 上下文对象，包含当前解析所需的所有信息。
 * @param ancestors 祖先节点数组，用于跟踪当前解析位置的父节点信息。
 */
function parseChildren(context, ancestors) {
  const nodes: any = []; // 存储解析过程中生成的节点

  while (!isEnd(context, ancestors)) {
    let node;
    const s = context.source;
    // 根据不同的起始标识符进行不同的解析处理
    if (startsWith(s, "{{")) {
      // 如果当前是以 {{ 开头的插值表达式,则进行插值解析
      node = parseInterpolation(context);
    } else if (s[0] === "<") {
      // 如果当前是以 < 开头的标签
      if (s[1] === "/") {
        // 如果是关闭标签
        if (/[a-z]/i.test(s[2])) {
          // 如果关闭标签是有效的，则进行解析，并继续当前循环
          parseTag(context, TagType.End);
          continue;
        }
      } else if (/[a-z]/i.test(s[1])) {
        // 如果是开始标签，则进行元素解析
        node = parseElement(context, ancestors);
      }
    }
  }
}

/**
 * 解析元素节点。
 * @param context 解析上下文，包含当前解析位置和源数据等信息。
 * @param ancestors 祖先元素节点数组，用于跟踪当前解析位置的父级元素。
 * @returns 返回解析后的元素节点，包含标签信息和子元素。
 */
function parseElement(context, ancestors) {
  // 解析起始标签
  const element = parseTag(context, TagType.Start);

  ancestors.push(element);
  // 解析子元素
  const children = parseChildren(context, ancestors);
  ancestors.pop();

  // 解析结束标签，以确保语法正确，并检查结束标签是否与起始标签匹配
  if (startsWithEndTagOpen(context.source, element?.tag)) {
    parseTag(context, TagType.End);
  } else {
    throw new Error(`缺失结束标签：${element?.tag}`);
  }

  // 为元素节点添加子元素
  element && (element["children"] = children);

  return element;
}

/**
 * 解析HTML标签。
 * @param context 上下文对象，包含当前解析的位置和源代码等信息。
 * @param type 标签类型，区分开始标签或结束标签。
 * @returns 如果是开始标签，返回一个包含标签信息的对象；如果是结束标签，则不返回任何内容。
 */
function parseTag(context, type: TagType) {
  // 使用正则表达式从源代码中匹配标签
  const match: any = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source);
  const tag = match[1];

  // 移动光标到标签名称后的位置，准备解析下一个字符
  advanceBy(context, match[0].length);

  // 跳过"<"符号，准备解析标签名称
  advanceBy(context, 1);

  // 如果是结束标签，则不进一步处理，直接返回
  if (type === TagType.End) return;

  // 默认标签类型为元素类型
  let tagType = ElementTypes.ELEMENT;

  // 返回解析出的标签信息
  return {
    type: NodeTypes.ELEMENT,
    tag,
    tagType,
  };
}

/**
 * 检查给定的上下文是否表示一个元素的结束。
 * @param context 包含源字符串的上下文对象。
 * @param ancestors 当前解析过程中遇到的祖先元素数组。
 * @returns {boolean} 如果当前上下文表示一个元素的结束，则返回true；否则返回false。
 */
function isEnd(context, ancestors) {
  const s = context.source;
  // 检查源字符串是否以结束标签开始
  if (s.startsWith("</")) {
    // 遍历祖先元素，寻找是否有匹配的结束标签
    for (let i = ancestors.length - 1; i >= 0; --i) {
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        // 找到匹配的结束标签，返回true
        return true;
      }
    }
  }
}

/**
 * 检查给定的字符串源是否以特定的闭合标签开始。
 * @param source - 需要检查的字符串源。
 * @param tag - 指定的标签名称。
 * @returns 如果字符串源以指定的闭合标签开始，则返回true；否则返回false。
 */
function startsWithEndTagOpen(source: string, tag: string) {
  // 检查字符串源是否以 "</" 开头，并且接下来的部分与标签名称匹配。
  return (
    startsWith(source, "</") &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase()
  );
}

/**
 * 检查字符串是否以指定的前缀开始。
 * @param source - 被检查的源字符串。
 * @param searchString - 指定的前缀字符串。
 * @returns 返回一个布尔值，如果源字符串以指定的前缀开始，则为true；否则为false。
 */
function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString);
}

function parseInterpolation(context) {
  const openDelimiter = "{{";
  const closeDelimiter = "}}";

  const closeIndex = context.source.indexOf(
    closeDelimiter,
    openDelimiter.length
  );

  // 让代码前进2个长度，可以把 {{ 干掉
  advanceBy(context, 2);

  const rawContentLength = closeIndex - openDelimiter.length;
  const rawContent = context.source.slice(0, rawContentLength);

  const preTrimContent = parseTextData(context, rawContent.length);
  const content = preTrimContent.trim();

  // 最后在让代码前进2个长度，可以把 }} 干掉
  advanceBy(context, closeDelimiter.length);
}

/**
 * 解析文本数据
 * @param context 上下文对象，包含需要解析的源数据
 * @param length 需要解析的文本长度
 * @returns 返回解析得到的原始文本
 */
function parseTextData(context: any, length: number): any {
  console.log("解析 textData");

  // 从 context.source 中截取长度为 length 的文本
  const rawText = context.source.slice(0, length);

  // 根据截取的长度，更新解析位置（光标）
  advanceBy(context, length);

  return rawText;
}

/**
 * 将给定的上下文对象在源代码字符串中向前推进指定数量的字符。
 * @param context {Object} 上下文对象，需要包含一个源代码字符串的属性。
 * @param numberOfCharacters {number} 需要向前推进的字符数量。
 */
function advanceBy(context, numberOfCharacters) {
  console.log("推进代码", context, numberOfCharacters);
  // 更新上下文对象的源代码字符串，使其向前推进指定数量的字符
  context.source = context.source.slice(numberOfCharacters);
}

/**
 * 创建根节点
 * @param children 子节点数组
 * @returns 返回一个对象，表示根节点，包含类型、子节点和辅助函数数组
 */
function createRoot(children) {
  return {
    type: NodeTypes.ROOT, // 根节点的类型
    children, // 子节点数组
    helpers: [], // 辅助函数数组，初始为空
  };
}
