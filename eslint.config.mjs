// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
 {
    rules: {
      'vue/html-self-closing': [
        'off',
        {
          html: {
            void: 'never', // Allows self-closing on void elements like <input /> or <hr />
          },
        },
      ],
    },
  },
)
