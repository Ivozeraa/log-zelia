describe('Occurrences workflow', () => {
  const email = Cypress.env('USER_EMAIL') || 'teste2026@gmail.com'
  const password = Cypress.env('USER_PASSWORD') || '12345678'
  const todayDate = new Date().toISOString().split('T')[0]
  const uniqueDescription = `Cypress teste de ocorrência ${Date.now()}`

  beforeEach(() => {
    cy.login(email, password)
  })

  it('should create multiple occurrences (10)', () => {
    const count = 10

    for (let i = 1; i <= count; i++) {
      const desc = `Carga automática Cypress ${Date.now()} - ${i}`

      // Open modal
      cy.visit('/')
      cy.contains('button', 'Adicionar Advertência').should('be.visible').click()
      cy.contains('h2', 'Adicionar Advertência').should('be.visible')

      // Select first school, turma and aluno
      cy.selectFirstDropdownOption('Escola')
      cy.selectFirstDropdownOption('Turma')
      cy.contains('label', 'Aluno')
        .parent()
        .find('button')
        .first()
        .click()

      cy.get('div.absolute.left-0.right-0.top-full:visible')
        .find('button')
        .first()
        .click()

      // Tipo / Situação
      cy.selectDropdownOption('Tipo de advertência', 'Ocorrência')
      cy.selectDropdownOption('Tipo de situação', 'Indisciplina')

      // Date + description
      cy.get('input[type="date"]').first().clear().type(todayDate)
      cy.get('textarea[placeholder="Descreva a ocorrência..."]')
        .clear()
        .type(desc)

      // Submit
      cy.contains('button', 'Registrar').click()
      cy.contains('Ocorrência registrada com sucesso!', { timeout: 10000 }).should('be.visible')

      // small pause to avoid race conditions
      cy.wait(500)
    }
  })

  it('should add a new occurrence from the dashboard', () => {
    cy.visit('/')
    cy.contains('button', 'Adicionar Advertência').should('be.visible').click()

    cy.contains('h2', 'Adicionar Advertência').should('be.visible')

    cy.selectFirstDropdownOption('Escola')
    cy.selectFirstDropdownOption('Turma')
    cy.contains('label', 'Aluno')
      .parent()
      .find('button')
      .first()
      .click()

    cy.get('div.absolute.left-0.right-0.top-full:visible')
      .find('button')
      .first()
      .click()

    cy.selectDropdownOption('Tipo de advertência', 'Ocorrência')
    cy.selectDropdownOption('Tipo de situação', 'Indisciplina')

    cy.get('input[type="date"]').first().clear().type(todayDate)
    cy.get('textarea[placeholder="Descreva a ocorrência..."]')
      .clear()
      .type(uniqueDescription)

    cy.contains('button', 'Registrar').click()

    cy.contains('Ocorrência registrada com sucesso!', { timeout: 10000 })
      .should('be.visible')
  })

  it('should display occurrences and open student details', () => {
    cy.visit('/advertencias')

    cy.contains('Advertências', { timeout: 10000 }).should('be.visible')
    cy.get('input[placeholder="Nome do aluno"]').should('exist')
    cy.get('#apenasComOcorrencia').should('exist')

    cy.contains('label', 'Exibir somente alunos com ocorrência')
      .should('exist')
      .parent()
      .find('input[type="checkbox"]')
      .check({ force: true })
      .should('be.checked')

    cy.get('table tbody tr').then(($rows) => {
      if ($rows.length === 0) {
        cy.contains('Nenhum aluno encontrado.').should('exist')
        return
      }

      // click the student name button inside the first row using within()
      cy.get('table tbody tr').first().within(() => {
        cy.get('[data-cy="student-name-button"]').first().click()
      })

      cy.contains('Histórico de Ocorrências').should('be.visible')
      cy.contains('Detalhes completos das ocorrências registradas para este aluno.').should('be.visible')

      cy.contains('button', '← Voltar para lista').click()
      cy.contains('Alunos exibidos').should('be.visible')
    })
  })
})