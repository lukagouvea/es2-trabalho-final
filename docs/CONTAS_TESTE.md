# Contas para testes locais e no Supabase hospedado

Aplicação local: http://127.0.0.1:5197

Senha de todas as contas abaixo: `Campus123!`

| E-mail | Perfil | Setor de atendimento |
| --- | --- | --- |
| comunidade@campus.test | Comunidade | Sem vínculo |
| eletrica@campus.test | Manutenção | Elétrica |
| hidraulica@campus.test | Manutenção | Hidráulica |
| infraestrutura@campus.test | Manutenção | Infraestrutura e acessibilidade |
| equipamentos@campus.test | Manutenção | Equipamentos |
| admin@campus.test | Administração | Sem vínculo |
| admin.manutencao@campus.test | Administração e manutenção | Elétrica |

As contas foram criadas e verificadas no Supabase local e, a pedido do usuário, também no Supabase hospedado do projeto `smithdqjyuxsimxbjmdf` em 16/11/2026. Login, confirmação de e-mail, privilégios administrativos e vínculos de setor foram conferidos no projeto hospedado. Essas contas não fazem parte das migrações; um reset do banco local remove somente as contas locais.

A conta `admin` configura setores, categorias e vínculos, mas não atende ocorrências sem vínculo. `admin.manutencao` também pode atender o setor de elétrica. As contas dos setores permitem verificar fila e atendimento restritos, além de transferência entre setores. Todas possuem as funções da comunidade.
