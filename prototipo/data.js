/* Ocorrências e setores fictícios; os pontos de referência vêm do OpenStreetMap. */
window.CampusData = (() => {
  const statuses = {
    registrada: { label: 'Registrada', tone: 'amber', icon: 'clock' },
    analise: { label: 'Em análise', tone: 'blue', icon: 'search' },
    andamento: { label: 'Em andamento', tone: 'orange', icon: 'tool' },
    resolvida: { label: 'Resolvida', tone: 'green', icon: 'check' },
    encerrada: { label: 'Encerrada', tone: 'gray', icon: 'archive' }
  };
  const initial = () => {
    const sectors = [
      { id: 'eletrica', name: 'Manutenção elétrica', description: 'Iluminação e instalações elétricas.', active: true },
      { id: 'hidraulica', name: 'Manutenção hidráulica', description: 'Vazamentos e instalações hidráulicas.', active: true },
      { id: 'infraestrutura', name: 'Infraestrutura e acessibilidade', description: 'Pisos, acessos e estruturas do campus.', active: true },
      { id: 'equipamentos', name: 'Manutenção de equipamentos', description: 'Mobiliário e equipamentos de uso comum.', active: true }
    ];
    const categories = [
      { id: 'iluminacao', name: 'Iluminação', icon: 'bulb', tone: 'amber', sector: 'eletrica', active: true },
      { id: 'vazamento', name: 'Vazamento', icon: 'drop', tone: 'blue', sector: 'hidraulica', active: true },
      { id: 'acessibilidade', name: 'Acessibilidade', icon: 'accessibility', tone: 'green', sector: 'infraestrutura', active: true },
      { id: 'equipamento', name: 'Equipamentos', icon: 'tool', tone: 'orange', sector: 'equipamentos', active: true }
    ];
    const users = [
      { id: 'marina', name: 'Marina Oliveira', email: 'marina@exemplo.com', role: 'member', sectors: [] },
      { id: 'joao', name: 'João Santos', email: 'joao@exemplo.com', role: 'member', sectors: ['eletrica', 'equipamentos'] },
      { id: 'ana', name: 'Ana Costa', email: 'ana@exemplo.com', role: 'admin', sectors: [] },
      { id: 'carlos', name: 'Carlos Lima', email: 'carlos@exemplo.com', role: 'member', sectors: ['hidraulica'] },
      { id: 'beatriz', name: 'Beatriz Alves', email: 'beatriz@exemplo.com', role: 'member', sectors: ['infraestrutura'] },
      { id: 'lucas', name: 'Lucas Ferreira', email: 'lucas@exemplo.com', role: 'member', sectors: [] }
    ];
    const raw = [
      ['026', 'Poste apagado próximo à biblioteca', 'iluminacao', 'andamento', 'Biblioteca Central', 29, 37, 'marina', '2026-10-05T18:20:00-03:00', 12, 'Dois postes no caminho de acesso à biblioteca estão apagados. À noite, o trecho fica com pouca visibilidade.'],
      ['027', 'Bebedouro com vazamento', 'vazamento', 'registrada', 'Restaurante Universitário', 18, 57, 'lucas', '2026-10-07T08:15:00-03:00', 7, 'O bebedouro próximo à entrada está vazando continuamente, deixando o piso molhado.'],
      ['025', 'Rampa com passagem obstruída', 'acessibilidade', 'analise', 'Centro de Ciências', 42, 42, 'beatriz', '2026-10-04T10:30:00-03:00', 9, 'Há peças de mobiliário bloqueando parte da rampa de acesso ao prédio.'],
      ['024', 'Banco danificado no jardim', 'equipamento', 'registrada', 'Jardim central', 51, 68, 'marina', '2026-10-03T12:40:00-03:00', 3, 'Um dos bancos do jardim está com uma tábua solta e precisa de reparo.'],
      ['023', 'Lâmpada piscando no corredor', 'iluminacao', 'analise', 'Pavilhão P. H. Rolfs', 33, 18, 'lucas', '2026-10-02T17:10:00-03:00', 5, 'A lâmpada do corredor principal está piscando durante todo o dia.'],
      ['022', 'Torneira sem fechar completamente', 'vazamento', 'andamento', 'DCE', 56, 81, 'marina', '2026-10-01T09:00:00-03:00', 4, 'A torneira da área de uso comum não fecha completamente e fica gotejando.'],
      ['021', 'Piso irregular na passagem', 'acessibilidade', 'registrada', 'Área esportiva', 78, 76, 'lucas', '2026-09-30T14:00:00-03:00', 8, 'O piso da passagem apresenta um desnível que dificulta a circulação.'],
      ['020', 'Cadeira com apoio solto', 'equipamento', 'resolvida', 'Biblioteca Central', 26, 32, 'marina', '2026-09-28T10:00:00-03:00', 2, 'Uma cadeira da área de leitura está com o apoio solto.', '2026-10-02T10:00:00-03:00'],
      ['019', 'Iluminação da entrada', 'iluminacao', 'resolvida', 'Centro de Ciências', 47, 50, 'lucas', '2026-10-01T10:00:00-03:00', 6, 'A iluminação da entrada não está acendendo.', '2026-10-03T10:00:00-03:00'],
      ['018', 'Vazamento na área externa', 'vazamento', 'resolvida', 'Restaurante Universitário', 14, 62, 'marina', '2026-10-02T10:00:00-03:00', 4, 'Há um vazamento na conexão da tubulação da área externa.', '2026-10-04T10:00:00-03:00'],
      ['017', 'Registro repetido de iluminação', 'iluminacao', 'encerrada', 'Biblioteca Central', 35, 33, 'lucas', '2026-10-03T09:00:00-03:00', 1, 'Relato de falha na iluminação do caminho para a biblioteca.'],
      ['016', 'Corrimão com fixação solta', 'acessibilidade', 'resolvida', 'DCE', 60, 85, 'beatriz', '2026-09-25T10:00:00-03:00', 3, 'O corrimão da entrada está com uma fixação solta.', '2026-09-29T10:00:00-03:00']
    ];
    const occurrences = raw.map(([id, title, category, status, location, x, y, author, createdAt, count, description, resolvedAt]) => {
      const sector = categories.find(c => c.id === category).sector;
      const responsible = users.find(u => u.sectors.includes(sector)).id;
      const history = [{ title: 'Ocorrência registrada', text: `Encaminhada para ${sectors.find(s => s.id === sector).name.toLowerCase()}.`, author, date: createdAt, status: 'registrada' }];
      const after = hours => new Date(new Date(createdAt).getTime() + hours * 3600000).toISOString();
      if (status !== 'registrada') history.push({ title: 'Análise iniciada', text: 'O setor está avaliando o problema relatado.', author: responsible, date: after(4), status: 'analise' });
      if (['andamento', 'resolvida'].includes(status)) history.push({ title: 'Atendimento iniciado', text: 'A equipe iniciou a manutenção no local.', author: responsible, date: after(12), status: 'andamento' });
      if (status === 'resolvida') history.push({ title: 'Ocorrência resolvida', text: 'Realizado o reparo e verificado o funcionamento no local.', author: responsible, date: resolvedAt, status });
      if (status === 'encerrada') history.push({ title: 'Ocorrência encerrada', text: 'O problema já foi registrado em outra ocorrência. O atendimento será acompanhado no registro original.', author: responsible, date: after(6), status });
      return { id, title, category, sector, status, location, x, y, author, createdAt, resolvedAt: resolvedAt || null, description, photo: null, confirmations: [], baseConfirmations: count, contributions: id === '026' ? [{ id: 'info1', author: 'lucas', text: 'O problema também acontece no poste mais próximo da entrada lateral.', date: '2026-10-06T19:15:00-03:00' }] : [], history };
    });
    const data = { version: 1, users, sectors, categories, occurrences, nextId: 28 };
    window.CampusGeo.migrate(data);
    return data;
  };
  return { initial, statuses, demoDate: '2026-10-07', storageKey: 'campus-em-dia-prototipo-v1' };
})();
