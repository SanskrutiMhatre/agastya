<?xml version="1.0" encoding="UTF-8"?>
<!-- ********************************************************************
     S1000D  ->  JSS book XML

     Stage 1 of the JSS pipeline:

         S1000D XML  ->  [s1000dtojss]  ->  jssbook XML
         jssbook XML ->  [jsstofo]      ->  XSL-FO  ->  PDF

     The publication module (PM) supplies the book structure: each top-level
     pmEntry becomes a JSS chapter, and each dmRef inside it resolves to the
     data module that provides the chapter's sections. A source file holding a
     single dmodule and no PM is emitted as a one-chapter book.

     Only the mapping lives here. All page layout stays in jsstofo/, and the
     S1000D-to-PDF pipeline in s1000dtofo/ is untouched.
     ******************************************************************** -->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xi="http://www.w3.org/2001/XInclude"
  exclude-result-prefixes="xsi">

    <xsl:output method="xml" indent="yes" encoding="UTF-8"/>

    <!-- ==================================================================== -->
    <!--                            PARAMETERS                                 -->
    <!-- ==================================================================== -->
    <!-- Book / system identity. Left empty these are derived from the PM or
         the first data module. -->
    <!-- Height an icon-style <symbol> renders at; mirrors s1000dtofo's own
         symbol.size so both engines draw icons the same. -->
    <xsl:param name="symbol.size">10mm</xsl:param>
    <xsl:param name="book.name"/>
    <xsl:param name="system.name"/>
    <xsl:param name="security.classification"/>

    <!-- Where ICN graphics live, and the extension to assume. S1000D references
         graphics through @infoEntityIdent, which resolves via an unparsed
         entity declared in the DTD. Flat schema instances carry no DTD, so the
         ICN is mapped onto a file path instead. -->
    <!-- Set by the build to the hand-authored abbreviations stencil, but
         only when that file exists: document() on a missing href is fatal. -->
    <xsl:param name="abbrev.stencil"/>
    <!-- Path to the generated page-order file; empty = use the built-in order. -->
    <xsl:param name="frontmatter.order"/>
    <!-- Generated list of publishers; empty = use the built-in pair. -->
    <xsl:param name="publishers.file"/>
    <!-- Media path of the system illustration, from frontMatter.systemImage. -->
    <xsl:param name="system.image"/>
    <xsl:param name="graphics.dir">Media/</xsl:param>
    <xsl:param name="graphics.ext">.png</xsl:param>

    <!--
      Directory holding the referenced data modules, relative to the publication
      module. Empty means they sit beside it. Only the file name from each
      xi:include href is used, so a stale directory prefix in the PM does not
      have to match the real layout.
    -->
    <xsl:param name="csdb.dir"/>

    <!-- Title-page artwork. Paths are relative to the project root, which is
         the working directory FOP runs in. -->
    <xsl:param name="emblem.src">Media/Satya.png</xsl:param>
    <xsl:param name="publisher.logo.src">Media/LT.png</xsl:param>

    <!-- Second joint publisher on the "Jointly Prepared & Published by" title
         page. S1000D names only one responsiblePartnerCompany, so the further
         parties are supplied here. Empty by default (single-publisher project);
         config.js only emits these params when the house template lists a
         second publisher, so a project must opt in rather than opt out. -->
    <xsl:param name="publisher2.name"></xsl:param>
    <xsl:param name="publisher2.logo.src"></xsl:param>
    <xsl:param name="publisher2.address"></xsl:param>

    <!-- Publication identity for the title pages. Empty by default, in which
         case the PM-derived values (or blank) are used, so output is unchanged
         until the settings supply them. -->
    <xsl:param name="pub.publicationNo"/>
    <xsl:param name="pub.inbrNo"/>
    <xsl:param name="pub.nsn"/>
    <xsl:param name="pub.contractNo"/>
    <xsl:param name="pub.projectCode"/>
    <xsl:param name="pub.ltDocumentNo"/>

    <!-- Emit the standard front matter (xi:include references resolved by the
         stage-2 run). Set to 0 for a body-only book. -->
    <xsl:param name="include.frontmatter">1</xsl:param>

    <!-- ==================================================================== -->
    <!--                            VARIABLES                                  -->
    <!-- ==================================================================== -->
    <xsl:variable name="all.dmodules" select="//dmodule"/>
    <xsl:variable name="pm" select="(//pm)[1]"/>

    <!--
      A PM may carry its data modules either inline (a <publication> wrapper) or
      by reference. The CSDB style references them with xi:include, so the first
      data module used for book metadata may live in another file.
    -->
    <xsl:variable name="first.dm.doc">
        <xsl:for-each select="(//xi:include/@href)[1]">
            <xsl:call-template name="csdb-path"/>
        </xsl:for-each>
    </xsl:variable>
    <!-- Same two-step lookup as the section templates: the href as written,
         then the file name alone under $csdb.dir. -->
    <xsl:variable name="first.dm"
        select="($all.dmodules
                 | document((//xi:include/@href)[1])/dmodule
                 | document(string($first.dm.doc), /)/dmodule)[1]"/>

    <xsl:variable name="lower">abcdefghijklmnopqrstuvwxyz</xsl:variable>
    <xsl:variable name="upper">ABCDEFGHIJKLMNOPQRSTUVWXYZ</xsl:variable>

    <xsl:include href="identity.xsl"/>
    <xsl:include href="content.xsl"/>
    <xsl:include href="schemas.xsl"/>

    <!-- ==================================================================== -->
    <!--                              ROOT                                     -->
    <!-- ==================================================================== -->
    <xsl:template match="/">
        <jssbook>
            <xsl:call-template name="bookmeta"/>
            <xsl:if test="$include.frontmatter = '1'">
                <xsl:call-template name="frontmatter"/>
            </xsl:if>
            <body>
                <xsl:choose>
                    <!-- PM present: it defines the chapter order -->
                    <xsl:when test="$pm">
                        <xsl:apply-templates select="$pm/content/pmEntry" mode="chapter"/>
                    </xsl:when>
                    <!-- No PM: one chapter per data module -->
                    <xsl:otherwise>
                        <xsl:for-each select="$all.dmodules">
                            <chapter number="{position()}">
                                <title><xsl:call-template name="dm-title"/></title>
                                <xsl:apply-templates select="content"/>
                            </chapter>
                        </xsl:for-each>
                    </xsl:otherwise>
                </xsl:choose>
            </body>
        </jssbook>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                             BOOK META                                 -->
    <!-- ==================================================================== -->
    <xsl:template name="bookmeta">
        <bookmeta>
            <bookName>
                <xsl:choose>
                    <xsl:when test="$book.name != ''"><xsl:value-of select="$book.name"/></xsl:when>
                    <xsl:when test="$pm">
                        <xsl:value-of select="$pm/identAndStatusSection/pmAddress/pmAddressItems/pmTitle"/>
                    </xsl:when>
                    <xsl:otherwise>User Handbook</xsl:otherwise>
                </xsl:choose>
            </bookName>
            <systemName>
                <xsl:choose>
                    <xsl:when test="$system.name != ''"><xsl:value-of select="$system.name"/></xsl:when>
                    <xsl:otherwise>
                        <xsl:value-of select="$first.dm/identAndStatusSection/dmAddress/dmAddressItems/dmTitle/techName"/>
                    </xsl:otherwise>
                </xsl:choose>
            </systemName>
            <security>
                <xsl:call-template name="security-label"/>
            </security>
            <publicationNo>
                <xsl:choose>
                    <xsl:when test="$pub.publicationNo != ''"><xsl:value-of select="$pub.publicationNo"/></xsl:when>
                    <xsl:when test="$pm"><xsl:call-template name="pm-code"/></xsl:when>
                </xsl:choose>
            </publicationNo>
            <inbrNo><xsl:value-of select="$pub.inbrNo"/></inbrNo>
            <nsn><xsl:value-of select="$pub.nsn"/></nsn>
            <contractNo><xsl:value-of select="$pub.contractNo"/></contractNo>
            <projectCode><xsl:value-of select="$pub.projectCode"/></projectCode>
            <ltDocumentNo><xsl:value-of select="$pub.ltDocumentNo"/></ltDocumentNo>
            <xsl:call-template name="issue-month-year"/>
            <emblem src="{$emblem.src}"/>
            <!--
              Header logo and producing company, carried through from the
              S1000D source so the JSS engine can print them the way the
              direct engine does.

              The logo is wrapped in a <graphic> rather than given as a bare
              src, so the build's dimension-annotation pass repairs the path
              for free: that pass rewrites <graphic src> when the guessed file
              is not on disk, matching by name with or without the extension.
              Without the wrapper the guess below — always ".png" — would miss
              a logo supplied as .svg or .jpg, which is the usual case.
            -->
            <xsl:variable name="logo.sym"
              select="($pm/identAndStatusSection/pmStatus/logo/symbol
                     | $first.dm/identAndStatusSection/dmStatus/logo/symbol)[1]"/>
            <xsl:variable name="logo.icn" select="normalize-space($logo.sym/@infoEntityIdent)"/>
            <xsl:if test="$logo.icn != ''">
              <headerLogo>
                <xsl:variable name="declared" select="unparsed-entity-uri($logo.icn)"/>
                <!-- Only an entity that names an image FILE is usable. A
                     DOCTYPE copied from a sample declares SYSTEM "", which
                     resolves to the source document itself. -->
                <xsl:variable name="low" select="translate($declared, $upper, $lower)"/>
                <graphic>
                  <xsl:attribute name="src">
                    <xsl:choose>
                      <xsl:when test="$declared != ''
                                      and (substring($low, string-length($low) - 3) = '.png'
                                        or substring($low, string-length($low) - 3) = '.jpg'
                                        or substring($low, string-length($low) - 3) = '.gif'
                                        or substring($low, string-length($low) - 3) = '.svg'
                                        or substring($low, string-length($low) - 4) = '.jpeg')">
                        <xsl:value-of select="$declared"/>
                      </xsl:when>
                      <xsl:otherwise>
                        <xsl:value-of select="concat($graphics.dir, $logo.icn, $graphics.ext)"/>
                      </xsl:otherwise>
                    </xsl:choose>
                  </xsl:attribute>
                </graphic>
              </headerLogo>
            </xsl:if>
            <!-- Named by the publication where it says so, else by the first
                 data module; the two agree in a well-formed publication. -->
            <producedBy>
              <xsl:value-of select="normalize-space(
                ($pm/identAndStatusSection/pmStatus/responsiblePartnerCompany/enterpriseName
                 | $first.dm/identAndStatusSection/dmStatus/responsiblePartnerCompany/enterpriseName)[1])"/>
            </producedBy>
            <!--
              Publishers come from a file the build generates from settings, so
              a book can carry any number of them. This used to be built here
              with the first publisher's name and address hardcoded and a single
              optional second, which is why a third never appeared and why the
              first ignored what Settings said.

              The old two-publisher construction is kept as the fallback for a
              build that does not supply the file.
            -->
            <xsl:choose>
                <xsl:when test="$publishers.file != ''">
                    <xsl:copy-of select="document($publishers.file, /)/publishers"/>
                </xsl:when>
                <xsl:otherwise>
                    <publishers>
                        <publisher>
                            <logo src="{$publisher.logo.src}"/>
                            <name>
                                <xsl:variable name="rpc"
                                    select="$first.dm/identAndStatusSection/dmStatus/responsiblePartnerCompany/enterpriseName"/>
                                <xsl:choose>
                                    <xsl:when test="$rpc != ''"><xsl:value-of select="$rpc"/></xsl:when>
                                    <xsl:otherwise>L&amp;T Defence,</xsl:otherwise>
                                </xsl:choose>
                            </name>
                            <addressLine>LARSEN &amp; TOUBRO LIMITED</addressLine>
                        </publisher>
                        <xsl:if test="$publisher2.name != ''">
                            <publisher>
                                <logo src="{$publisher2.logo.src}"/>
                                <name><xsl:value-of select="$publisher2.name"/></name>
                                <addressLine><xsl:value-of select="$publisher2.address"/></addressLine>
                            </publisher>
                        </xsl:if>
                    </publishers>
                </xsl:otherwise>
            </xsl:choose>
        </bookmeta>
    </xsl:template>

    <!--
      Front matter, in the order the project's settings specify.

      The build writes that order to a small file and passes it as
      $frontmatter.order; each entry says either "include this page file" or
      "emit this empty element for the stylesheet to fill in". Previously the
      list was hardcoded here as well as in the direct engine's injector — two
      copies that had to be kept in step by hand, so the two pipelines could
      silently produce different books.

      With no order file (an older project, or a build that did not write one)
      this falls back to the historical fixed list, so nothing changes for a
      project that has never touched these settings.
    -->
    <xsl:template name="frontmatter">
        <frontmatter>
            <xsl:choose>
                <xsl:when test="$frontmatter.order != ''">
                    <xsl:for-each select="document($frontmatter.order, /)/pages/page">
                        <xsl:choose>
                            <xsl:when test="@file">
                                <xi:include href="{concat('jss/frontmatter/', @file)}"/>
                            </xsl:when>
                            <xsl:when test="@element = 'listOfAbbreviations'">
                                <xsl:for-each select="/"><xsl:call-template name="abbreviations"/></xsl:for-each>
                            </xsl:when>
                            <xsl:when test="@element = 'systemNamePage'">
                                <systemNamePage>
                                    <xsl:if test="$system.image != ''">
                                        <graphic src="{$system.image}"/>
                                    </xsl:if>
                                </systemNamePage>
                            </xsl:when>
                            <xsl:otherwise>
                                <xsl:element name="{@element}"/>
                            </xsl:otherwise>
                        </xsl:choose>
                    </xsl:for-each>
                </xsl:when>
                <xsl:otherwise>
                    <xi:include href="jss/frontmatter/01-title-page-joint.xml"/>
                    <xi:include href="jss/frontmatter/02-title-page.xml"/>
                    <xi:include href="jss/frontmatter/03-proprietary.xml"/>
                    <xi:include href="jss/frontmatter/04-foreword.xml"/>
                    <xi:include href="jss/frontmatter/05-record-of-changes.xml"/>
                    <xi:include href="jss/frontmatter/06-associated-handbooks.xml"/>
                    <xi:include href="jss/frontmatter/07-safety-warning.xml"/>
                    <xi:include href="jss/frontmatter/08-first-aid.xml"/>
                    <xi:include href="jss/frontmatter/09-cautions-notes.xml"/>
                    <xi:include href="jss/frontmatter/10-demolition.xml"/>
                    <xi:include href="jss/frontmatter/11-change-notice.xml"/>
                    <xsl:call-template name="abbreviations"/>
                    <listOfContents/>
                    <listOfFigures/>
                    <listOfTables/>
                    <systemNamePage>
                        <xsl:if test="$system.image != ''">
                            <graphic src="{$system.image}"/>
                        </xsl:if>
                    </systemNamePage>
                    <xi:include href="jss/frontmatter/13-description-of-symbols.xml"/>
                </xsl:otherwise>
            </xsl:choose>
        </frontmatter>
    </xsl:template>

    <!--
      The book's abbreviation list, from two sources.

      Harvested <acronym> markup comes first. On top of that, entries written
      by hand in jss/frontmatter/12-list-of-abbreviations.xml are merged in:
      harvesting only finds terms an author actually tagged, so a book with no
      <acronym> markup could otherwise never have an abbreviations page at all,
      with no file to add one to. The direct S1000D engine includes that
      stencil directly; this keeps the two engines behaving the same.

      The build passes $abbrev.stencil only when the file exists, because
      document() on a missing href is fatal.
    -->
    <xsl:template name="abbreviations">
        <!-- Context changes inside the document() loop below, so hold on to
             the source root while it still means the source. -->
        <xsl:variable name="src" select="/"/>
        <listOfAbbreviations>
            <xsl:for-each select="//acronym">
                <!-- de-duplicate on the acronym term -->
                <xsl:variable name="t" select="normalize-space(acronymTerm)"/>
                <xsl:if test="not(preceding::acronym[normalize-space(acronymTerm) = $t])">
                    <abbreviation term="{$t}">
                        <xsl:value-of select="normalize-space(acronymDefinition)"/>
                    </abbreviation>
                </xsl:if>
            </xsl:for-each>
            <xsl:if test="$abbrev.stencil != ''">
                <xsl:for-each select="document($abbrev.stencil, /)/listOfAbbreviations/abbreviation">
                    <xsl:variable name="t" select="normalize-space(@term)"/>
                    <!-- A term already tagged in the source wins; the harvested
                         definition is the authoritative one. -->
                    <xsl:if test="not($src//acronym[normalize-space(acronymTerm) = $t])">
                        <abbreviation term="{$t}">
                            <xsl:value-of select="normalize-space(.)"/>
                        </abbreviation>
                    </xsl:if>
                </xsl:for-each>
            </xsl:if>
        </listOfAbbreviations>
    </xsl:template>

    <!-- ==================================================================== -->
    <!--                     PM  ->  CHAPTER STRUCTURE                         -->
    <!-- ==================================================================== -->
    <!--
      Each top-level pmEntry becomes a chapter. Its title comes from
      pmEntryTitle; the sections come from whatever the entry contains: nested
      pmEntries become sections, and dmRefs resolve to data modules.
    -->
    <xsl:template match="pmEntry" mode="chapter">
        <chapter number="{position()}">
            <!--
              Page orientation, using the same marker the S1000D pipeline reads:
              <pmEntry id="a4-landscape"> or id="a3-landscape". A chapter is one
              page-sequence, so the whole chapter takes the orientation.
            -->
            <xsl:choose>
                <xsl:when test="@id = 'a3-landscape'">
                    <xsl:attribute name="orientation">a3-landscape</xsl:attribute>
                </xsl:when>
                <xsl:when test="@id = 'a4-landscape' or @id = 'landscape'">
                    <xsl:attribute name="orientation">landscape</xsl:attribute>
                </xsl:when>
            </xsl:choose>
            <title>
                <xsl:choose>
                    <xsl:when test="pmEntryTitle"><xsl:value-of select="pmEntryTitle"/></xsl:when>
                    <xsl:otherwise>
                        <!-- Fall back to the title of the first DM it references -->
                        <xsl:for-each select="(.//dmRef)[1]">
                            <xsl:call-template name="resolve-dmref-title"/>
                        </xsl:for-each>
                    </xsl:otherwise>
                </xsl:choose>
            </title>
            <xsl:apply-templates select="pmEntry | dmRef | dmodule | xi:include" mode="section"/>
        </chapter>
    </xsl:template>

    <!--
      An untitled pmEntry is pure structure: it exists only to wrap a single
      data module reference. Emitting a section for it too would nest every
      chapter one level deeper under an empty heading, so it is passed through
      and the data module supplies the section.
    -->
    <xsl:template match="pmEntry[not(pmEntryTitle)]" mode="section">
        <xsl:apply-templates select="pmEntry | dmRef | dmodule | xi:include" mode="section"/>
    </xsl:template>

    <!-- A titled nested pmEntry becomes a section holding its own children -->
    <!--
      This section's own orientation marker was missing entirely — the
      top-level chapter template a few lines up reads @id and stamps
      @orientation on the <chapter> it produces; this one never did the same
      for the <section> it produces. entry-orientation (below) still found
      the marker correctly for anything INSIDE this pmEntry, since it walks
      ancestor-or-self::pmEntry regardless of which template is asking — so
      a data module nested two levels under <pmEntry id="a3-landscape"> came
      out landscape, correctly. But the section itself — its own title page,
      "2.1 <pmEntryTitle>", with no data module content of its own to carry
      the marker — had no @orientation to inherit FROM, and jsstofo's
      effective-orientation (headers_footers.xsl's counterpart in the direct
      engine; body.xsl here) walks ancestor-or-self::section[@orientation]
      first, the chapter's own orientation only as a fallback: a marked
      pmEntry nested inside an UNMARKED chapter produced a section with
      nothing on it to find, so that title page rendered on the chapter's
      own (portrait) orientation while everything actually inside the
      section still correctly went landscape by its own, separate lookup.
    -->
    <xsl:template match="pmEntry" mode="section">
        <xsl:variable name="orientation">
            <xsl:call-template name="entry-orientation"/>
        </xsl:variable>
        <section>
            <xsl:if test="$orientation != ''">
                <xsl:attribute name="orientation"><xsl:value-of select="$orientation"/></xsl:attribute>
            </xsl:if>
            <title>
                <xsl:choose>
                    <xsl:when test="pmEntryTitle"><xsl:value-of select="pmEntryTitle"/></xsl:when>
                    <xsl:otherwise>
                        <xsl:for-each select="(.//dmRef)[1]">
                            <xsl:call-template name="resolve-dmref-title"/>
                        </xsl:for-each>
                    </xsl:otherwise>
                </xsl:choose>
            </title>
            <xsl:apply-templates select="pmEntry | dmRef | dmodule | xi:include" mode="section"/>
        </section>
    </xsl:template>

    <!--
      Resolve a dmRef against the data modules present in the source tree.
      Matching is on the full DM code, the same identity the S1000D pipeline
      uses. An unresolved reference is reported and skipped rather than
      silently dropped.
    -->
    <xsl:template match="dmRef" mode="section">
        <xsl:variable name="wanted">
            <xsl:for-each select="dmRefIdent">
                <xsl:call-template name="dmcode-string"/>
            </xsl:for-each>
        </xsl:variable>

        <!-- Count of matches, so an unresolved reference can be reported -->
        <xsl:variable name="matches">
            <xsl:for-each select="$all.dmodules">
                <xsl:variable name="this">
                    <xsl:for-each select="identAndStatusSection/dmAddress/dmIdent">
                        <xsl:call-template name="dmcode-string"/>
                    </xsl:for-each>
                </xsl:variable>
                <xsl:if test="$this = $wanted">x</xsl:if>
            </xsl:for-each>
        </xsl:variable>

        <xsl:for-each select="$all.dmodules">
            <xsl:variable name="this">
                <xsl:for-each select="identAndStatusSection/dmAddress/dmIdent">
                    <xsl:call-template name="dmcode-string"/>
                </xsl:for-each>
            </xsl:variable>
            <xsl:if test="$this = $wanted">
                <section id="dm-{$wanted}">
                    <title><xsl:call-template name="dm-title"/></title>
                    <xsl:apply-templates select="content"/>
                </section>
            </xsl:if>
        </xsl:for-each>

        <xsl:if test="$matches = ''">
            <xsl:message>
                <xsl:text>PM references a data module that is not present in the source: </xsl:text>
                <xsl:value-of select="$wanted"/>
            </xsl:message>
        </xsl:if>
    </xsl:template>

    <!-- A dmodule embedded directly in the PM entry -->
    <xsl:template match="dmodule" mode="section">
        <xsl:param name="orientation"/>
        <xsl:variable name="dmid">
            <xsl:for-each select="identAndStatusSection/dmAddress/dmIdent">
                <xsl:call-template name="dmcode-string"/>
            </xsl:for-each>
        </xsl:variable>
        <section id="dm-{$dmid}">
            <xsl:if test="$orientation != ''">
                <xsl:attribute name="orientation"><xsl:value-of select="$orientation"/></xsl:attribute>
            </xsl:if>
            <title><xsl:call-template name="dm-title"/></title>
            <xsl:apply-templates select="content"/>
        </section>
    </xsl:template>

    <!--
      Page orientation for a single data module, taken from the nearest
      enclosing pmEntry that carries the marker:

        <pmEntry id="a4-landscape"><xi:include href="..."/></pmEntry>

      The same marker on a top-level pmEntry turns the whole chapter, so one
      convention covers chapter, section and per-data-module granularity.
    -->
    <xsl:template name="entry-orientation">
        <xsl:variable name="marked"
            select="(ancestor-or-self::pmEntry[@id = 'a4-landscape'
                                            or @id = 'a3-landscape'
                                            or @id = 'landscape'])[last()]"/>
        <xsl:choose>
            <xsl:when test="$marked/@id = 'a3-landscape'">a3-landscape</xsl:when>
            <xsl:when test="$marked">landscape</xsl:when>
        </xsl:choose>
    </xsl:template>

    <!--
      A data module pulled in by reference. The transform loads it itself rather
      than relying on XInclude, so the href's directory prefix does not have to
      match where the files actually sit: only the file name is used, resolved
      against $csdb.dir (relative to the publication module).
    -->
    <xsl:template match="xi:include" mode="section">
        <xsl:variable name="orientation">
            <xsl:call-template name="entry-orientation"/>
        </xsl:variable>
        <!-- The href as written, resolved against the publication module. -->
        <xsl:variable name="direct" select="document(@href)/dmodule"/>
        <xsl:choose>
            <xsl:when test="$direct">
                <xsl:apply-templates select="$direct" mode="section">
                    <xsl:with-param name="orientation" select="$orientation"/>
                </xsl:apply-templates>
            </xsl:when>
            <xsl:otherwise>
                <!-- Retry on the file name alone, under $csdb.dir, so a stale
                     directory prefix in the PM still finds the data module. -->
                <xsl:variable name="path">
                    <xsl:for-each select="@href">
                        <xsl:call-template name="csdb-path"/>
                    </xsl:for-each>
                </xsl:variable>
                <xsl:variable name="dm" select="document(string($path), /)/dmodule"/>
                <xsl:choose>
                    <xsl:when test="$dm">
                        <xsl:apply-templates select="$dm" mode="section">
                            <xsl:with-param name="orientation" select="$orientation"/>
                        </xsl:apply-templates>
                    </xsl:when>
                    <xsl:otherwise>
                        <xsl:message>
                            <xsl:text>Data module not found, skipped: </xsl:text>
                            <xsl:value-of select="@href"/>
                        </xsl:message>
                    </xsl:otherwise>
                </xsl:choose>
            </xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <!--
      Build the path to a referenced data module: the file name from @href
      (context node), prefixed with $csdb.dir.
    -->
    <xsl:template name="csdb-path">
        <xsl:variable name="file">
            <xsl:call-template name="basename">
                <xsl:with-param name="path" select="string(.)"/>
            </xsl:call-template>
        </xsl:variable>
        <xsl:value-of select="concat($csdb.dir, $file)"/>
    </xsl:template>

    <!-- Last path segment of a '/'-separated path -->
    <xsl:template name="basename">
        <xsl:param name="path"/>
        <xsl:choose>
            <xsl:when test="contains($path, '/')">
                <xsl:call-template name="basename">
                    <xsl:with-param name="path" select="substring-after($path, '/')"/>
                </xsl:call-template>
            </xsl:when>
            <xsl:otherwise><xsl:value-of select="$path"/></xsl:otherwise>
        </xsl:choose>
    </xsl:template>

    <xsl:template name="resolve-dmref-title">
        <xsl:choose>
            <xsl:when test="dmRefAddressItems/dmTitle">
                <xsl:value-of select="dmRefAddressItems/dmTitle/techName"/>
                <xsl:if test="dmRefAddressItems/dmTitle/infoName">
                    <xsl:text> - </xsl:text>
                    <xsl:value-of select="dmRefAddressItems/dmTitle/infoName"/>
                </xsl:if>
            </xsl:when>
            <xsl:otherwise>Chapter</xsl:otherwise>
        </xsl:choose>
    </xsl:template>

</xsl:stylesheet>
