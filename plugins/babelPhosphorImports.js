module.exports = ({ types }) => ({
  visitor: {
    ImportDeclaration(importPath) {
      const { node } = importPath;
      if (node.source.value !== 'phosphor-react-native' || node.importKind === 'type') return;
      const remaining = [];
      const icons = [];
      for (const specifier of node.specifiers) {
        if (!types.isImportSpecifier(specifier) || specifier.importKind === 'type' || specifier.imported.name === 'IconContext') {
          remaining.push(specifier);
          continue;
        }
        const name = specifier.imported.name;
        const icon = name.endsWith('Icon') ? name.slice(0, -4) : name;
        icons.push(types.importDeclaration([specifier], types.stringLiteral(`phosphor-react-native/src/icons/${icon}`)));
      }
      if (icons.length === 0) return;
      if (remaining.length) icons.unshift(types.importDeclaration(remaining, node.source));
      importPath.replaceWithMultiple(icons);
    },
  },
});
