# Arquitetura multi-escola

O LogView usa `escola_id` como fronteira de isolamento. O banco continua sendo a autoridade final por meio de RLS e validações relacionais.

## Regra do frontend

- Usuário comum: `escola_id` vem da conta autenticada e não é editável.
- Conta global: pode selecionar uma escola quando a tela explicitamente oferecer operação multi-escola.
- Nunca confiar no `escola_id` enviado pelo cliente como mecanismo de segurança; ele deve ser tratado apenas como contexto de interface. O Supabase continua impondo o isolamento.

## Helpers

Use `src/utils/schoolScope.js`:

```js
import { resolveSchoolId, canSelectSchool, scopePayload } from '../utils/schoolScope';
```

Para operações de uma escola específica:

```js
const targetSchoolId = resolveSchoolId({
  selectedSchoolId,
  schoolId,
  isGlobalAdmin,
});

const payload = scopePayload(data, {
  schoolId,
  isGlobalAdmin,
});
```

Para componentes de seleção:

```js
const showSchoolSelector = canSelectSchool(isGlobalAdmin);
```

A recomendação é não adicionar novas telas que aceitem `escola_id` livremente sem passar por essas regras.
