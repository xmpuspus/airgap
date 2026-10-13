import fsp from 'node:fs/promises';
import path from 'node:path';

export interface RenameOptions {
  targetDir: string;
  botName: string;
}

export interface RenameDerived {
  npmName: string; // kebab-case, e.g. "acme-support"
  pascalName: string; // PascalCase, e.g. "AcmeSupport" (used for native targets)
  packageSlug: string; // lowercase no-hyphens, e.g. "acmesupport" (used as java package leaf)
  androidPackage: string; // e.g. "com.acmesupport"
}

export function deriveNames(botName: string): RenameDerived {
  const npmName = botName.toLowerCase();
  const parts = npmName.split('-').filter(Boolean);
  const pascalName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  // Java packages cannot contain hyphens, and android namespaces by convention
  // use lowercase. Strip hyphens for the leaf segment.
  const packageSlug = parts.join('');
  const androidPackage = `com.${packageSlug}`;
  return {npmName, pascalName, packageSlug, androidPackage};
}

async function readFile(p: string): Promise<string> {
  return fsp.readFile(p, 'utf8');
}

async function writeFile(p: string, content: string): Promise<void> {
  await fsp.writeFile(p, content, 'utf8');
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rewriteJson(p: string, fn: (json: Record<string, unknown>) => void): Promise<void> {
  if (!(await fileExists(p))) return;
  const text = await readFile(p);
  const json = JSON.parse(text) as Record<string, unknown>;
  fn(json);
  await writeFile(p, JSON.stringify(json, null, 2) + '\n');
}

async function replaceInFile(
  p: string,
  replacements: Array<[RegExp | string, string]>,
): Promise<void> {
  if (!(await fileExists(p))) return;
  let text = await readFile(p);
  for (const [pattern, replacement] of replacements) {
    if (typeof pattern === 'string') {
      text = text.split(pattern).join(replacement);
    } else {
      text = text.replace(pattern, replacement);
    }
  }
  await writeFile(p, text);
}

async function moveDir(src: string, dest: string): Promise<void> {
  if (!(await fileExists(src))) return;
  if (await fileExists(dest)) {
    // Same path on case-insensitive filesystems counts as existing.
    if (path.resolve(src) === path.resolve(dest)) return;
    throw new Error(`Cannot move ${src} -> ${dest}: destination exists`);
  }
  await fsp.mkdir(path.dirname(dest), {recursive: true});
  await fsp.rename(src, dest);
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  if (!(await fileExists(dir))) return out;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const entries = await fsp.readdir(cur, {withFileTypes: true});
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

export async function rename(opts: RenameOptions): Promise<void> {
  const {targetDir, botName} = opts;
  const {npmName, pascalName, packageSlug, androidPackage} = deriveNames(botName);

  await rewriteJson(path.join(targetDir, 'package.json'), json => {
    json.name = npmName;
  });

  await rewriteJson(path.join(targetDir, 'app.json'), json => {
    json.name = pascalName;
    json.displayName = pascalName;
  });

  await replaceInFile(path.join(targetDir, 'android', 'app', 'build.gradle'), [
    [/namespace\s+"com\.airgap"/g, `namespace "${androidPackage}"`],
    [/applicationId\s+"com\.airgap"/g, `applicationId "${androidPackage}"`],
  ]);

  // Modern RN templates keep the namespace in build.gradle, not in a package
  // attribute here, so only leftover com.airgap mentions need a rewrite.
  await replaceInFile(
    path.join(targetDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
    [['com.airgap', androidPackage]],
  );

  const oldJavaDir = path.join(targetDir, 'android', 'app', 'src', 'main', 'java', 'com', 'airgap');
  const newJavaDir = path.join(
    targetDir,
    'android',
    'app',
    'src',
    'main',
    'java',
    'com',
    packageSlug,
  );
  if (oldJavaDir !== newJavaDir) {
    await moveDir(oldJavaDir, newJavaDir);
  }

  // Rewrite package declarations and component name strings in every
  // Kotlin/Java source under the new dir.
  if (await fileExists(newJavaDir)) {
    const sources = await walk(newJavaDir);
    for (const file of sources) {
      if (file.endsWith('.kt') || file.endsWith('.java')) {
        await replaceInFile(file, [
          [/package\s+com\.airgap\b/g, `package ${androidPackage}`],
          [/"Airgap"/g, `"${pascalName}"`],
        ]);
      }
    }
  }

  await replaceInFile(
    path.join(targetDir, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
    [
      [
        /<string name="app_name">[^<]*<\/string>/g,
        `<string name="app_name">${pascalName}</string>`,
      ],
    ],
  );

  // CFBundleName and CFBundleIdentifier come from Xcode build variables
  // (PRODUCT_NAME, PRODUCT_BUNDLE_IDENTIFIER), so only the literal display
  // name needs a rewrite.
  await replaceInFile(path.join(targetDir, 'ios', 'Airgap', 'Info.plist'), [
    [
      /<key>CFBundleDisplayName<\/key>\s*<string>Airgap<\/string>/g,
      `<key>CFBundleDisplayName</key>\n\t<string>${pascalName}</string>`,
    ],
  ]);

  await replaceInFile(path.join(targetDir, 'ios', 'Podfile'), [
    [/target ['"]Airgap['"] do/g, `target '${pascalName}' do`],
    [/target ['"]AirgapTests['"] do/g, `target '${pascalName}Tests' do`],
  ]);

  // Rewrite the references inside project.pbxproj and contents.xcworkspacedata
  // before the directories move, because the paths below use the old names.
  const xcodeproj = path.join(targetDir, 'ios', 'Airgap.xcodeproj', 'project.pbxproj');
  if (await fileExists(xcodeproj)) {
    await replaceInFile(xcodeproj, [[/Airgap/g, pascalName]]);
  }
  const workspaceData = path.join(
    targetDir,
    'ios',
    'Airgap.xcworkspace',
    'contents.xcworkspacedata',
  );
  if (await fileExists(workspaceData)) {
    await replaceInFile(workspaceData, [[/Airgap/g, pascalName]]);
  }

  const iosDirs: Array<[string, string]> = [
    ['Airgap', pascalName],
    ['Airgap.xcodeproj', `${pascalName}.xcodeproj`],
    ['Airgap.xcworkspace', `${pascalName}.xcworkspace`],
    ['AirgapTests', `${pascalName}Tests`],
  ];
  for (const [oldName, newName] of iosDirs) {
    const oldPath = path.join(targetDir, 'ios', oldName);
    const newPath = path.join(targetDir, 'ios', newName);
    if (oldName !== newName) {
      await moveDir(oldPath, newPath);
    }
  }

  // Drop a marker so anyone inspecting the scaffold can see what changed.
  await fsp.writeFile(
    path.join(targetDir, '.airgap-scaffold.json'),
    JSON.stringify(
      {
        botName: npmName,
        pascalName,
        androidPackage,
        scaffoldedAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );
}
