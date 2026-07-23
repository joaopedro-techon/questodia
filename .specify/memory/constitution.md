<!--
Sync Impact Report
- Version change: TEMPLATE (unratified) → 1.0.0
- Ratification type: Initial adoption (MAJOR baseline)
- Modified principles: N/A (first version) — filled all 5 placeholder principles
  - [PRINCIPLE_1] → I. Simplicidade Primeiro (KISS & YAGNI)
  - [PRINCIPLE_2] → II. Código Legível e Autoexplicativo
  - [PRINCIPLE_3] → III. Funções Pequenas e Responsabilidade Única
  - [PRINCIPLE_4] → IV. Consistência e Formatação Automática
  - [PRINCIPLE_5] → V. Validação Funcional em vez de Testes Unitários
- Added sections: Padrões de Qualidade de Código; Fluxo de Desenvolvimento; Governança
- Removed sections: None
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check já genérico; sem mudança necessária)
  - ✅ .specify/templates/tasks-template.md (testes já OPCIONAIS; alinhado ao Princípio V)
  - ✅ .specify/templates/spec-template.md (sem seções obrigatórias de teste; alinhado)
- Deferred TODOs: None
-->

# Kahoot Constitution

## Core Principles

### I. Simplicidade Primeiro (KISS & YAGNI)

O projeto DEVE priorizar a solução mais simples que resolva o problema atual.

- Implemente apenas o que é necessário agora; funcionalidades "para o futuro" NÃO devem
  ser adicionadas até existir necessidade concreta (YAGNI).
- Prefira soluções diretas a abstrações genéricas; padrões de projeto e camadas extras só
  se justificam por uma dor real e presente.
- Toda dependência externa DEVE ser justificada — se pode ser resolvido com poucas linhas
  de código próprio e claro, evite adicionar bibliotecas.

**Racional**: Complexidade é o principal custo de manutenção. Um projeto simples é mais
fácil de ler, alterar e depurar por qualquer pessoa.

### II. Código Legível e Autoexplicativo

O código DEVE comunicar sua intenção sem exigir comentários para ser entendido.

- Nomes de variáveis, funções e arquivos DEVEM descrever propósito, não implementação.
- Comentários explicam o "porquê" de decisões não óbvias, nunca o "o quê" já evidente no código.
- Evite abreviações obscuras, números mágicos e aninhamento profundo; extraia constantes
  nomeadas e retorne cedo (early return) para reduzir indentação.

**Racional**: Código é lido muito mais vezes do que escrito. Clareza reduz o tempo para
entender e alterar com segurança.

### III. Funções Pequenas e Responsabilidade Única

Cada função ou módulo DEVE fazer uma coisa e fazê-la bem.

- Uma função DEVE ter um único propósito claro; se precisar de "e" para descrevê-la, divida-a.
- Evite efeitos colaterais ocultos — entradas e saídas DEVEM ser previsíveis.
- Elimine duplicação (DRY) quando ela representar o MESMO conceito; não force reuso de
  trechos que apenas parecem semelhantes.

**Racional**: Unidades pequenas e focadas são mais fáceis de entender, reaproveitar e
substituir sem efeitos colaterais em cascata.

### IV. Consistência e Formatação Automática

O estilo do código DEVE ser uniforme em todo o projeto e aplicado por ferramentas, não por revisão manual.

- Um formatador e um linter DEVEM ser configurados e executados antes de cada commit.
- Convenções de nomenclatura, estrutura de pastas e organização de imports DEVEM seguir um
  padrão único e documentado.
- Discussões sobre estilo pessoal NÃO ocorrem em revisão — a ferramenta é a autoridade.

**Racional**: Consistência elimina atrito cognitivo e desloca a energia da revisão para o
que importa: correção e clareza da lógica.

### V. Validação Funcional em vez de Testes Unitários

Este projeto NÃO exige testes unitários; a corretude é verificada exercitando o comportamento real.

- Testes unitários automatizados são OPCIONAIS e podem ser adicionados quando trouxerem
  valor claro (ex.: lógica complexa ou frágil), mas nunca são obrigatórios.
- Toda mudança significativa DEVE ser validada rodando a aplicação e observando o fluxo
  afetado de ponta a ponta antes de considerá-la concluída.
- Passos de validação manual (o que foi exercitado e o resultado observado) DEVEM ser
  descritos ao entregar a mudança.

**Racional**: Para um projeto simples, validar o comportamento real oferece confiança
suficiente sem o custo de manter uma suíte de testes extensa.

## Padrões de Qualidade de Código

- O código DEVE estar formatado e sem erros de lint antes de ser integrado.
- Erros e casos de falha DEVEM ser tratados de forma explícita e legível; falhas silenciosas
  NÃO são aceitáveis.
- Segredos, credenciais e chaves NÃO devem ser versionados; use variáveis de ambiente ou
  arquivos ignorados pelo controle de versão.
- Cada arquivo DEVE ter uma responsabilidade clara refletida em seu nome e localização.

## Fluxo de Desenvolvimento

- Cada funcionalidade DEVE ser entregue como um incremento pequeno e funcional.
- Antes de concluir uma tarefa, o autor DEVE: (1) rodar formatador e linter, (2) validar o
  comportamento executando a aplicação, e (3) descrever a validação realizada.
- Complexidade adicional (nova dependência, nova camada, nova abstração) DEVE ser
  justificada explicitamente frente ao Princípio I.

## Governança

Esta constituição tem precedência sobre outras práticas informais do projeto.

- Emendas DEVEM ser documentadas neste arquivo, com atualização de versão e data.
- Versionamento segue Semantic Versioning:
  - **MAJOR**: remoção ou redefinição incompatível de um princípio ou regra de governança.
  - **MINOR**: adição de novo princípio/seção ou expansão material de orientação.
  - **PATCH**: esclarecimentos, correções de texto e ajustes não semânticos.
- Toda entrega DEVE ser compatível com estes princípios; violações precisam ser corrigidas
  ou justificadas explicitamente na seção de complexidade do plano.
- Em caso de conflito entre velocidade e estes princípios, a simplicidade e a clareza
  (Princípios I e II) prevalecem.

**Version**: 1.0.0 | **Ratified**: 2026-07-21 | **Last Amended**: 2026-07-21
