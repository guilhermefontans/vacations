# Roteiro Ferias

Aplicacao mobile-first em Next.js + React para acompanhar o progresso da viagem por cidade.

## Funcionalidades

- Menu inicial com cards de Paris, Madri, Barcelona e Roma.
- Cada card mostra:
  - foto da cidade
  - nome
  - data de inicio e fim da viagem
  - porcentagem de atracoes visitadas
- Cores por progresso:
  - abaixo de 60%: vermelho suave e borda vermelha
  - de 60% a 85%: amarelo
  - acima de 85%: verde e texto de check abaixo do card
- Pagina de detalhe da cidade com:
  - foto de plano de fundo
  - porcentagem no topo
  - lista de eventos ordenada por horario
  - checkbox editavel quando a fonte de dados estiver em `gist`
  - link para Google Maps de cada endereco
- Cache em memoria infinito apos o primeiro carregamento.
- Botao de atualizar na listagem para forcar nova leitura da fonte configurada.

## Variaveis de ambiente

Crie um arquivo `.env.local` baseado em `.env.example`:

```bash
cp .env.example .env.local
```

Preencha:

- `DATA_SOURCE`: `file`, `google` ou `gist`
- `GOOGLE_SHEETS_CSV_URL`: URL publica CSV da aba (obrigatoria se `DATA_SOURCE=google`)
- `GITHUB_TOKEN`: token do GitHub com permissao de `gist`
- `GIST_ID`: id do Gist onde o JSON sera salvo
- `GIST_FILENAME`: nome do arquivo JSON dentro do Gist. Padrao: `events.json`
- `APP_ENVIRONMENT`: opcional, mantido como fallback de compatibilidade

Comportamento por ambiente:

- `DATA_SOURCE=file`: usa os dados locais versionados em `src/data/events.json`
- `DATA_SOURCE=google`: usa Google Sheets em modo somente leitura (CSV publico)
- `DATA_SOURCE=gist`: le e grava o arquivo JSON por API, permitindo atualizacao pela UI sem banco

Exemplo para atualizar pela UI sem banco:

```bash
DATA_SOURCE=gist
GITHUB_TOKEN=seu_token
GIST_ID=seu_gist_id
GIST_FILENAME=events.json
```

Recomendacao: use um Gist dedicado para os dados. Cada alteracao regrava o arquivo inteiro, o que funciona bem para JSON pequeno como este `events.json`.

## Cache e atualizacao

1. Com `DATA_SOURCE=file`, os dados sao lidos do JSON local do projeto.
2. Com `DATA_SOURCE=google`, no primeiro acesso a aplicacao baixa os dados da planilha e guarda em cache no servidor.
3. Com `DATA_SOURCE=gist`, a aplicacao le e atualiza o JSON remoto por API.
4. Ao clicar no botao de atualizar da listagem, a aplicacao recarrega a fonte configurada.

## Estrutura esperada da planilha

A aba deve ter o cabecalho na primeira linha.

Colunas obrigatorias:

- `id`
- `pais`
- `cidade`
- `evento`
- `datetime`
- `checked`
- `endereco`

Colunas opcionais recomendadas:

- `imagem_card`
- `imagem_detalhe`

Exemplo CSV:

```csv
id,pais,cidade,evento,datetime,checked,endereco,imagem_card,imagem_detalhe
paris-01,Franca,Paris,Torre Eiffel,2026-07-10T09:00:00,false,Champ de Mars Paris,https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80,https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=80
paris-02,Franca,Paris,Museu do Louvre,2026-07-10T14:00:00,true,Rue de Rivoli Paris,,
madri-01,Espanha,Madri,Parque do Retiro,2026-07-12T10:00:00,false,Plaza de la Independencia Madrid,,
barcelona-01,Espanha,Barcelona,Sagrada Familia,2026-07-15T09:30:00,true,Carrer de Mallorca Barcelona,,
roma-01,Italia,Roma,Coliseu,2026-07-18T08:30:00,false,Piazza del Colosseo Roma,,
```

## Rodando localmente

Instale dependencias e execute:

```bash
npm install
npm run dev
```

Abra http://localhost:3000
