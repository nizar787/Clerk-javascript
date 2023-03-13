/* eslint-disable @typescript-eslint/no-var-requires */
const webpack = require('webpack');
const packageJSON = require('./package.json');
const path = require('path');
const { merge } = require('webpack-merge');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const ReactRefreshTypeScript = require('react-refresh-typescript');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

const isProduction = mode => mode === 'production';
const isDevelopment = mode => !isProduction(mode);

const variants = {
  clerk: 'clerk',
  clerkBrowser: 'clerk.browser',
  clerkHeadless: 'clerk.headless',
  clerkHeadlessBrowser: 'clerk.headless.browser',
};

const variantToSourceFile = {
  [variants.clerk]: './src/index.ts',
  [variants.clerkBrowser]: './src/index.browser.ts',
  [variants.clerkHeadless]: './src/index.headless.ts',
  [variants.clerkHeadlessBrowser]: './src/index.headless.browser.ts',
};

/** @type { () => import('webpack').Configuration } */
const common = ({ mode }) => {
  return {
    mode,
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: isDevelopment(mode),
        __PKG_VERSION__: JSON.stringify(packageJSON.version),
        __PKG_NAME__: JSON.stringify(packageJSON.name),
      }),
      new webpack.EnvironmentPlugin({
        CLERK_ENV: mode,
        NODE_ENV: mode,
      }),
    ],
  };
};

const svgLoader = () => {
  return {
    test: /\.svg$/,
    use: ['@svgr/webpack'],
  };
};

const typescriptLoaderProd = () => {
  return {
    test: /\.(ts|js)x?$/,
    exclude: /node_modules/,
    use: [
      {
        loader: 'ts-loader',
        options: { transpileOnly: true },
      },
    ],
  };
};

const typescriptLoaderDev = () => {
  return {
    test: /\.(ts|js)x?$/,
    exclude: /node_modules/,
    use: [
      {
        loader: 'ts-loader',
        options: {
          configFile: 'tsconfig.dev.json',
          transpileOnly: true,
          getCustomTransformers: () => ({
            before: [ReactRefreshTypeScript()],
          }),
        },
      },
    ],
  };
};

/** @type { () => (import('webpack').Configuration) } */
const commonForProd = () => {
  return {
    devtool: undefined,
    module: {
      rules: [svgLoader(), typescriptLoaderProd()],
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      chunkFilename: pathData =>
        !(pathData.chunk.name || '').startsWith('shared')
          ? `[name].[fullhash:6].${packageJSON.version}.js`
          : `shared-[id].[fullhash:6].${packageJSON.version}.js`,
      filename: '[name].js',
      libraryTarget: 'umd',
      globalObject: 'globalThis',
    },
    optimization: {
      splitChunks: {
        name: (module, chunks) => (chunks.length > 0 ? `shared-${chunks.map(chunk => chunk.name).join('-')}` : ''),
      },
    },
  };
};

/** @type { () => (import('webpack').Configuration) } */
const externalsForHeadless = () => {
  return {
    externals: {
      react: 'react',
      'react-dom': 'react-dom',
    },
  };
};

const entryForVariant = variant => {
  return { entry: { [variant]: variantToSourceFile[variant] } };
};

/** @type { () => (import('webpack').Configuration)[] } */
const prodConfig = ({ mode, env }) => {
  const variant = env.variant || undefined;

  const entryToConfigMap = {
    // prettier-ignore
    [variants.clerk]: merge(
      entryForVariant(variants.clerk),
      common({ mode }),
      commonForProd(),
    ),
    // prettier-ignore
    [variants.clerkBrowser]: merge(
      entryForVariant(variants.clerkBrowser),
      common({ mode }),
      commonForProd(),
    ),
    [variants.clerkHeadless]: merge(
      entryForVariant(variants.clerkHeadless),
      common({ mode }),
      commonForProd(),
      // externalsForHeadless(),
    ),
    [variants.clerkHeadlessBrowser]: merge(
      entryForVariant(variants.clerkHeadlessBrowser),
      common({ mode }),
      commonForProd(),
      // externalsForHeadless(),
    ),
  };

  if (variant) {
    if (!entryToConfigMap[variant]) {
      throw new Error('Clerk variant does not exist in config');
    }
    return entryToConfigMap[variant];
  }

  return [...Object.values(entryToConfigMap)];
};

const devConfig = ({ mode, env }) => {
  const variant = env.variant || variants.clerkBrowser;

  const commonForDev = () => {
    return {
      module: {
        rules: [svgLoader(), typescriptLoaderDev()],
      },
      plugins: [
        new ReactRefreshWebpackPlugin({ overlay: { sockHost: 'js.lclclerk.com' } }),
        ...(env.serveAnalyzer ? [new BundleAnalyzerPlugin()] : []),
      ],
      devtool: 'eval-cheap-source-map',
      output: {
        publicPath: 'https://js.lclclerk.com/npm/',
        crossOriginLoading: 'anonymous',
        filename: `${variant}.js`,
        libraryTarget: 'umd',
        chunkFilename: `[name].[fullhash:6].${packageJSON.version}.js`,
      },
      optimization: {
        splitChunks: {
          name: (module, chunks) =>
            chunks
              .map(chunk => chunk.name?.replace('Organization', 'Org')?.replace('User', 'Us')?.slice(0, 4))
              ?.join('-'),
        },
      },
      devServer: {
        allowedHosts: ['all'],
        headers: { 'Access-Control-Allow-Origin': '*' },
        host: '0.0.0.0',
        port: 4000,
        hot: true,
        liveReload: false,
        client: { webSocketURL: 'auto://js.lclclerk.com/ws' },
      },
    };
  };

  const entryToConfigMap = {
    // prettier-ignore
    [variants.clerk]: merge(
      entryForVariant(variants.clerk),
      common({ mode }),
      commonForDev(),
    ),
    // prettier-ignore
    [variants.clerkBrowser]: merge(
      entryForVariant(variants.clerkBrowser),
      common({ mode }),
      commonForDev(),
    ),
    [variants.clerkHeadless]: merge(
      entryForVariant(variants.clerkHeadless),
      common({ mode }),
      commonForDev(),
      // externalsForHeadless(),
    ),
    [variants.clerkHeadlessBrowser]: merge(
      entryForVariant(variants.clerkHeadlessBrowser),
      common({ mode }),
      commonForDev(),
      // externalsForHeadless(),
    ),
  };

  if (!entryToConfigMap[variant]) {
    throw new Error('Clerk variant does not exist in config');
  }

  return entryToConfigMap[variant];
};

module.exports = env => {
  const mode = env.production ? 'production' : 'development';
  return isProduction(mode) ? prodConfig({ mode, env }) : devConfig({ mode, env });
};